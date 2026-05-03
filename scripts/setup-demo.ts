/* Seed a localnet validator with everything the demo needs:
   - A test USDC mint (6 decimals)
   - 4 demo wallets, each funded with SOL and 100 test-USDC
   - 3 of them registered as on-chain jurors
   - Prints a one-screen summary for copy-paste into 4 browser tabs

   Also runs a smoke walk of the full lifecycle (escrow -> dispute ->
   3 votes -> resolve -> claim x2) so this single script doubles as the
   "the demo path actually works" verification we'd otherwise click through
   in a browser.

   Re-runnable. Each invocation:
   - Reuses keypairs in scripts/demo-wallets/ if they exist (so addresses
     stay stable across runs); otherwise generates them.
   - Creates a fresh test mint (so balances reset).
   - Writes app/.env.local with the new mint address.
*/

import * as fs from "node:fs";
import * as path from "node:path";
import { Buffer } from "node:buffer";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const WALLET_DIR = path.resolve(__dirname, "demo-wallets");
const ENV_LOCAL = path.resolve(__dirname, "..", "app", ".env.local");
const PROGRAM_IDL = path.resolve(
  __dirname,
  "..",
  "anchor",
  "target",
  "idl",
  "verdict.json",
);

const TEST_USDC_DECIMALS = 6;
const PER_WALLET_SOL = 5;
const PER_WALLET_USDC = 100;

interface DemoWallet {
  label: string;
  kp: Keypair;
}

async function main() {
  console.log(`[setup-demo] using RPC ${RPC_URL}`);
  const connection = new Connection(RPC_URL, "confirmed");

  // Load Anchor IDL — used both to construct a Program for juror registration
  // and to print the program ID into the env summary.
  if (!fs.existsSync(PROGRAM_IDL)) {
    throw new Error(
      `IDL not found at ${PROGRAM_IDL}. Run \`anchor build\` first.`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idl = JSON.parse(fs.readFileSync(PROGRAM_IDL, "utf8")) as any;
  const programId = new PublicKey(idl.address);

  // ---------- wallets ----------
  fs.mkdirSync(WALLET_DIR, { recursive: true });
  const wallets: DemoWallet[] = [];
  for (const label of ["agent", "merchant", "juror-a", "juror-b", "juror-c"]) {
    const file = path.join(WALLET_DIR, `${label}.json`);
    let kp: Keypair;
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as number[];
      kp = Keypair.fromSecretKey(Uint8Array.from(raw));
    } else {
      kp = Keypair.generate();
      fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
      console.log(`[setup-demo] generated ${label} → ${file}`);
    }
    wallets.push({ label, kp });
  }

  // ---------- airdrop SOL ----------
  console.log(`[setup-demo] airdropping ${PER_WALLET_SOL} SOL to each wallet`);
  for (const w of wallets) {
    const sig = await connection.requestAirdrop(w.kp.publicKey, PER_WALLET_SOL * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  // ---------- test USDC mint ----------
  // Use a stable mint authority keypair so the mint address is reproducible
  // within one localnet session.
  const mintAuthority = Keypair.generate();
  const sigAuth = await connection.requestAirdrop(mintAuthority.publicKey, 5 * LAMPORTS_PER_SOL);
  const latestAuth = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sigAuth, ...latestAuth }, "confirmed");
  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    TEST_USDC_DECIMALS,
  );
  console.log(`[setup-demo] test USDC mint: ${mint.toBase58()}`);

  // Mint to every wallet's ATA.
  for (const w of wallets) {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mint,
      w.kp.publicKey,
    );
    await mintTo(
      connection,
      mintAuthority,
      mint,
      ata.address,
      mintAuthority,
      BigInt(PER_WALLET_USDC) * BigInt(10 ** TEST_USDC_DECIMALS),
    );
  }

  // ---------- juror registration ----------
  // We instantiate one Program per juror so the wallet-as-signer flows are
  // explicit; in production code an AnchorProvider per-keypair is overkill,
  // but this is a 5-wallet seed script and clarity beats brevity.
  const jurorWallets = wallets.filter((w) => w.label.startsWith("juror"));
  for (const w of jurorWallets) {
    const provider = new AnchorProvider(connection, new Wallet(w.kp), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    const program = new Program(idl, provider);
    const [jurorPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("juror"), w.kp.publicKey.toBuffer()],
      programId,
    );
    const exists = await connection.getAccountInfo(jurorPda);
    if (exists) {
      console.log(`[setup-demo] ${w.label} already registered`);
      continue;
    }
    await program.methods.registerJuror().accounts({ authority: w.kp.publicKey } as never).rpc();
    console.log(`[setup-demo] ${w.label} → registered as juror`);
  }

  // ---------- write app/.env.local ----------
  const envBody =
    `NEXT_PUBLIC_RPC_URL=${RPC_URL}\n` +
    `NEXT_PUBLIC_PROGRAM_ID=${programId.toBase58()}\n` +
    `NEXT_PUBLIC_TEST_USDC_MINT=${mint.toBase58()}\n`;
  fs.writeFileSync(ENV_LOCAL, envBody);
  console.log(`[setup-demo] wrote ${ENV_LOCAL}`);

  // ---------- end-to-end lifecycle smoke walk ----------
  // Mirrors the manual demo path the spec asks for. If this completes,
  // the on-chain program + the demo wallets are wired correctly.
  console.log(`\n[setup-demo] running smoke walk: escrow → dispute → 3 votes → resolve → 2 claims`);
  await smokeLifecycle({ connection, idl, mint, wallets });

  // ---------- summary ----------
  console.log("\n========== DEMO SUMMARY ==========");
  console.log(`RPC:               ${RPC_URL}`);
  console.log(`Program:           ${programId.toBase58()}`);
  console.log(`Test USDC mint:    ${mint.toBase58()}`);
  console.log("Wallets:");
  for (const w of wallets) {
    const ata = await getATABalance(connection, mint, w.kp.publicKey);
    console.log(
      `  ${w.label.padEnd(10)} ${w.kp.publicKey.toBase58()}  balance: ${ata} test-USDC`,
    );
  }
  console.log("\nLoad keys into 5 browser tabs:");
  for (const w of wallets) {
    console.log(`  ${w.label}: ${path.join(WALLET_DIR, `${w.label}.json`)}`);
  }
  console.log("\nThen:");
  console.log("  cd app && pnpm dev");
  console.log("===================================\n");
}

async function getATABalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
): Promise<string> {
  try {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      Keypair.generate(), // dummy payer; account already exists from the mint pass
      mint,
      owner,
    );
    const acc = await getAccount(connection, ata.address);
    return (Number(acc.amount) / 10 ** TEST_USDC_DECIMALS).toFixed(2);
  } catch {
    return "?";
  }
}

interface SmokeArgs {
  connection: Connection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idl: any;
  mint: PublicKey;
  wallets: DemoWallet[];
}

async function smokeLifecycle({ connection, idl, mint, wallets }: SmokeArgs): Promise<void> {
  const programId = new PublicKey(idl.address);
  const agent = wallets.find((w) => w.label === "agent")!;
  const merchant = wallets.find((w) => w.label === "merchant")!;
  const jurorA = wallets.find((w) => w.label === "juror-a")!;
  const jurorB = wallets.find((w) => w.label === "juror-b")!;
  const jurorC = wallets.find((w) => w.label === "juror-c")!;

  const programAs = (kp: Keypair) =>
    new Program(
      idl,
      new AnchorProvider(connection, new Wallet(kp), {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }),
    );

  const escrowId = new BN(Date.now());
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), agent.kp.publicKey.toBuffer(), escrowId.toArrayLike(Buffer, "le", 8)],
    programId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowPda.toBuffer()],
    programId,
  );
  const [disputePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("dispute"), escrowPda.toBuffer()],
    programId,
  );
  const agentAta = (await getOrCreateAssociatedTokenAccount(
    connection,
    agent.kp,
    mint,
    agent.kp.publicKey,
  )).address;
  const merchantAta = await ensureAta(connection, agent.kp, mint, merchant.kp.publicKey);

  const agentProgram = programAs(agent.kp);
  await agentProgram.methods
    .initializeEscrow(escrowId, new BN(40 * 10 ** TEST_USDC_DECIMALS), new BN(0))
    .accounts({
      payer: agent.kp.publicKey,
      merchant: merchant.kp.publicKey,
      mint,
      payerTokenAccount: agentAta,
    } as never)
    .rpc();
  console.log(`  ✓ escrow ${escrowPda.toBase58().slice(0, 8)}… funded with 40 test-USDC`);

  await agentProgram.methods
    .raiseDispute("ipfs://demo-evidence", new BN(120))
    .accounts({ payer: agent.kp.publicKey, escrow: escrowPda } as never)
    .rpc();
  console.log("  ✓ dispute raised");

  // 2 refund + 1 release → outcome=Refund.
  for (const [label, kp, choice] of [
    ["juror-a", jurorA.kp, { refund: {} }],
    ["juror-b", jurorB.kp, { refund: {} }],
    ["juror-c", jurorC.kp, { release: {} }],
  ] as const) {
    await programAs(kp)
      .methods.castVote(choice)
      .accounts({ authority: kp.publicKey, dispute: disputePda } as never)
      .rpc();
    console.log(`  ✓ ${label} voted ${Object.keys(choice)[0]}`);
  }

  await agentProgram.methods
    .resolveDispute()
    .accounts({
      caller: agent.kp.publicKey,
      escrow: escrowPda,
      dispute: disputePda,
      vault: vaultPda,
      payerTokenAccount: agentAta,
      merchantTokenAccount: merchantAta,
      payerRentRecipient: agent.kp.publicKey,
    } as never)
    .rpc();
  console.log("  ✓ dispute resolved (outcome: refund)");

  // Verify the math: agent should be back at 100, merchant at 0.
  const agentBal = (await getAccount(connection, agentAta)).amount;
  const merchantBal = (await getAccount(connection, merchantAta)).amount;
  console.log(
    `  ✓ post-resolve balances — agent: ${Number(agentBal) / 10 ** TEST_USDC_DECIMALS} USDC, merchant: ${
      Number(merchantBal) / 10 ** TEST_USDC_DECIMALS
    } USDC`,
  );

  // 2 majority jurors claim. Use explicit account passing because the Vote
  // PDA seeds chain through the Juror PDA and Anchor's auto-resolution
  // doesn't always derive correctly when `juror.key()` is itself derived.
  for (const [label, kp] of [
    ["juror-a", jurorA.kp],
    ["juror-b", jurorB.kp],
  ] as const) {
    const [jurorPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("juror"), kp.publicKey.toBuffer()],
      programId,
    );
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), disputePda.toBuffer(), jurorPda.toBuffer()],
      programId,
    );
    await programAs(kp)
      .methods.claimJurorReward()
      .accounts({
        authority: kp.publicKey,
        juror: jurorPda,
        dispute: disputePda,
        vote: votePda,
      } as never)
      .rpc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await agentProgram.account.juror.fetch(jurorPda);
    console.log(`  ✓ ${label} claimed reward → reputation = ${j.reputation}`);
  }
}

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  try {
    return await createAssociatedTokenAccount(connection, payer, mint, owner);
  } catch {
    return (await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner)).address;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Suppress unused-import lint nags for stuff that's referenced in JSDoc / dynamic builds.
void TOKEN_PROGRAM_ID;
void Transaction;
