import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import {
  findDisputePda,
  findEscrowPda,
  findJurorPda,
  findVaultPda,
  findVotePda,
} from "./pdas";
import type { VerdictProgram } from "./program";
import type { DisputeOutcome } from "./shapes";

/** Build a register_juror instruction. */
export async function registerJurorIx(
  program: VerdictProgram,
  authority: PublicKey,
): Promise<TransactionInstruction> {
  const [juror] = findJurorPda(program.programId, authority);
  return program.methods
    .registerJuror()
    .accounts({
      authority,
      // SDK supplies juror + system_program explicitly so callers don't depend
      // on Anchor's auto-resolution at runtime.
      juror,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();
}

export interface InitializeEscrowArgs {
  payer: PublicKey;
  merchant: PublicKey;
  mint: PublicKey;
  payerTokenAccount: PublicKey;
  escrowId: BN;
  amount: BN;
  releaseAfter: BN;
}

export async function initializeEscrowIx(
  program: VerdictProgram,
  args: InitializeEscrowArgs,
): Promise<TransactionInstruction> {
  const [escrow] = findEscrowPda(program.programId, args.payer, args.escrowId);
  const [vault] = findVaultPda(program.programId, escrow);
  return program.methods
    .initializeEscrow(args.escrowId, args.amount, args.releaseAfter)
    .accounts({
      payer: args.payer,
      merchant: args.merchant,
      mint: args.mint,
      payerTokenAccount: args.payerTokenAccount,
      escrow,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();
}

export interface ReleaseEscrowArgs {
  payer: PublicKey;
  escrow: PublicKey;
  vault: PublicKey;
  merchantTokenAccount: PublicKey;
}

export async function releaseEscrowIx(
  program: VerdictProgram,
  args: ReleaseEscrowArgs,
): Promise<TransactionInstruction> {
  return program.methods
    .releaseEscrow()
    .accounts({
      payer: args.payer,
      escrow: args.escrow,
      vault: args.vault,
      merchantTokenAccount: args.merchantTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never)
    .instruction();
}

export interface RaiseDisputeArgs {
  payer: PublicKey;
  escrow: PublicKey;
  evidenceUri: string;
  votingWindowSeconds: BN;
}

export async function raiseDisputeIx(
  program: VerdictProgram,
  args: RaiseDisputeArgs,
): Promise<TransactionInstruction> {
  const [dispute] = findDisputePda(program.programId, args.escrow);
  return program.methods
    .raiseDispute(args.evidenceUri, args.votingWindowSeconds)
    .accounts({
      payer: args.payer,
      escrow: args.escrow,
      dispute,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();
}

export interface CastVoteArgs {
  authority: PublicKey;
  dispute: PublicKey;
  choice: DisputeOutcome;
}

export async function castVoteIx(
  program: VerdictProgram,
  args: CastVoteArgs,
): Promise<TransactionInstruction> {
  const [juror] = findJurorPda(program.programId, args.authority);
  const [vote] = findVotePda(program.programId, args.dispute, juror);
  return program.methods
    .castVote(args.choice)
    .accounts({
      authority: args.authority,
      juror,
      dispute: args.dispute,
      vote,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();
}

export interface ResolveDisputeArgs {
  caller: PublicKey;
  escrow: PublicKey;
  dispute: PublicKey;
  vault: PublicKey;
  payerTokenAccount: PublicKey;
  merchantTokenAccount: PublicKey;
  /** Pubkey to receive the closed vault's rent. Must equal escrow.payer. */
  payerRentRecipient: PublicKey;
}

export async function resolveDisputeIx(
  program: VerdictProgram,
  args: ResolveDisputeArgs,
): Promise<TransactionInstruction> {
  return program.methods
    .resolveDispute()
    .accounts({
      caller: args.caller,
      escrow: args.escrow,
      dispute: args.dispute,
      vault: args.vault,
      payerTokenAccount: args.payerTokenAccount,
      merchantTokenAccount: args.merchantTokenAccount,
      payerRentRecipient: args.payerRentRecipient,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never)
    .instruction();
}

export interface ClaimJurorRewardArgs {
  authority: PublicKey;
  dispute: PublicKey;
}

export async function claimJurorRewardIx(
  program: VerdictProgram,
  args: ClaimJurorRewardArgs,
): Promise<TransactionInstruction> {
  const [juror] = findJurorPda(program.programId, args.authority);
  const [vote] = findVotePda(program.programId, args.dispute, juror);
  return program.methods
    .claimJurorReward()
    .accounts({
      authority: args.authority,
      juror,
      dispute: args.dispute,
      vote,
    } as never)
    .instruction();
}
