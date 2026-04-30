import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet } from "@coral-xyz/anchor";
import {
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
import { expect } from "chai";
import {
  findEscrowPda,
  findVaultPda,
  getProgram,
  initializeEscrowIx,
  localProvider,
  releaseEscrowIx,
  VERDICT_PROGRAM_ID,
} from "../src";

const RPC_URL = process.env.SDK_TEST_RPC_URL ?? "http://127.0.0.1:8899";
const TEST_USDC_DECIMALS = 6;

async function airdrop(connection: Connection, pubkey: PublicKey, sol = 5): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

async function tokenAmount(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    const acc = await getAccount(connection, ata);
    return acc.amount;
  } catch {
    return 0n;
  }
}

describe("verdict-sdk smoke", () => {
  let connection: Connection;
  let provider: anchor.AnchorProvider;
  let mintAuthority: Keypair;
  let mint: PublicKey;

  before(async () => {
    connection = new Connection(RPC_URL, "confirmed");
    // Use a fresh wallet so the smoke test is independent of whatever the
    // operator has loaded in ~/.config/solana/id.json.
    const walletKp = Keypair.generate();
    await airdrop(connection, walletKp.publicKey, 10);
    provider = localProvider(connection, new Wallet(walletKp));

    mintAuthority = Keypair.generate();
    await airdrop(connection, mintAuthority.publicKey, 5);
    mint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      TEST_USDC_DECIMALS,
    );
  });

  it("happy-path escrow → release using SDK builders only", async () => {
    const program = getProgram(provider);
    expect(program.programId.toBase58()).to.equal(VERDICT_PROGRAM_ID.toBase58());

    const payer = Keypair.generate();
    const merchant = Keypair.generate();
    await airdrop(connection, payer.publicKey, 5);

    const payerAtaInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mint,
      payer.publicKey,
    );
    await mintTo(
      connection,
      mintAuthority,
      mint,
      payerAtaInfo.address,
      mintAuthority,
      100n * 10n ** BigInt(TEST_USDC_DECIMALS),
    );
    const merchantAta = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      mint,
      merchant.publicKey,
    );

    const escrowId = new BN(Date.now());
    const amount = new BN(40 * 10 ** TEST_USDC_DECIMALS);
    const [escrowPda] = findEscrowPda(program.programId, payer.publicKey, escrowId);
    const [vaultPda] = findVaultPda(program.programId, escrowPda);

    // initialize_escrow via SDK builder.
    const ixInit = await initializeEscrowIx(program, {
      payer: payer.publicKey,
      merchant: merchant.publicKey,
      mint,
      payerTokenAccount: payerAtaInfo.address,
      escrowId,
      amount,
      releaseAfter: new BN(0),
    });
    const txInit = new Transaction().add(ixInit);
    const sigInit = await provider.sendAndConfirm(txInit, [payer]);
    expect(sigInit).to.be.a("string");
    expect(await tokenAmount(connection, vaultPda)).to.equal(BigInt(amount.toString()));

    // release_escrow via SDK builder.
    const ixRelease = await releaseEscrowIx(program, {
      payer: payer.publicKey,
      escrow: escrowPda,
      vault: vaultPda,
      merchantTokenAccount: merchantAta,
    });
    const txRelease = new Transaction().add(ixRelease);
    await provider.sendAndConfirm(txRelease, [payer]);

    expect(await tokenAmount(connection, merchantAta)).to.equal(BigInt(amount.toString()));
    expect(await tokenAmount(connection, vaultPda)).to.equal(0n);
    const escrowInfo = await connection.getAccountInfo(escrowPda);
    expect(escrowInfo).to.be.null;
  });
});
