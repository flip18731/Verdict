import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Verdict } from "../target/types/verdict";

export const TEST_USDC_DECIMALS = 6;

// -------- PDA helpers --------

export function findEscrowPda(
  program: Program<Verdict>,
  payer: PublicKey,
  escrowId: BN,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), payer.toBuffer(), escrowId.toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
}

export function findVaultPda(
  program: Program<Verdict>,
  escrow: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrow.toBuffer()],
    program.programId,
  );
}

export function findDisputePda(
  program: Program<Verdict>,
  escrow: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute"), escrow.toBuffer()],
    program.programId,
  );
}

export function findJurorPda(
  program: Program<Verdict>,
  authority: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("juror"), authority.toBuffer()],
    program.programId,
  );
}

export function findVotePda(
  program: Program<Verdict>,
  dispute: PublicKey,
  juror: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), dispute.toBuffer(), juror.toBuffer()],
    program.programId,
  );
}

// -------- Funding / mint helpers --------

export async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol = 5,
): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
}

export async function setupTestMint(
  provider: anchor.AnchorProvider,
  authority: Keypair,
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    TEST_USDC_DECIMALS,
  );
}

export async function fundWalletWithUsdc(
  provider: anchor.AnchorProvider,
  mintAuthority: Keypair,
  mint: PublicKey,
  recipient: Keypair,
  uiAmount: number,
): Promise<PublicKey> {
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    mint,
    recipient.publicKey,
  );
  await mintTo(
    provider.connection,
    mintAuthority,
    mint,
    ata.address,
    mintAuthority,
    uiAmount * 10 ** TEST_USDC_DECIMALS,
  );
  return ata.address;
}

export async function createEmptyAta(
  provider: anchor.AnchorProvider,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  return createAssociatedTokenAccount(provider.connection, payer, mint, owner);
}

export async function tokenBalance(
  connection: anchor.web3.Connection,
  ata: PublicKey,
): Promise<bigint> {
  try {
    const acc = await getAccount(connection, ata);
    return acc.amount;
  } catch {
    return 0n;
  }
}

// -------- Account-existence helpers --------

export async function accountExists(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  return info !== null;
}

// -------- Anchor error matching --------

export function anchorErrorCode(err: unknown): string | undefined {
  if (err instanceof anchor.AnchorError) {
    return err.error.errorCode.code;
  }
  // Anchor sometimes wraps errors via web3.js SendTransactionError
  const e = err as { error?: { errorCode?: { code?: string } }; message?: string };
  if (e?.error?.errorCode?.code) return e.error.errorCode.code;
  if (typeof e?.message === "string") {
    const match = e.message.match(/Error Code: (\w+)/);
    if (match) return match[1];
  }
  return undefined;
}

export function expectAnchorError(err: unknown, code: string): void {
  const found = anchorErrorCode(err);
  if (found !== code) {
    throw new Error(
      `expected AnchorError "${code}" but got "${found ?? "unknown"}". raw: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// -------- Standard test program / system handles --------

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;
export const SYSTEM_PROGRAM = SystemProgram.programId;
export const RENT_SYSVAR = SYSVAR_RENT_PUBKEY;
