import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const ESCROW_SEED = Buffer.from("escrow");
const VAULT_SEED = Buffer.from("vault");
const DISPUTE_SEED = Buffer.from("dispute");
const JUROR_SEED = Buffer.from("juror");
const VOTE_SEED = Buffer.from("vote");

export function findEscrowPda(
  programId: PublicKey,
  payer: PublicKey,
  escrowId: BN,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, payer.toBuffer(), escrowId.toArrayLike(Buffer, "le", 8)],
    programId,
  );
}

export function findVaultPda(programId: PublicKey, escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, escrow.toBuffer()], programId);
}

export function findDisputePda(programId: PublicKey, escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([DISPUTE_SEED, escrow.toBuffer()], programId);
}

export function findJurorPda(programId: PublicKey, authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([JUROR_SEED, authority.toBuffer()], programId);
}

export function findVotePda(
  programId: PublicKey,
  dispute: PublicKey,
  juror: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, dispute.toBuffer(), juror.toBuffer()],
    programId,
  );
}
