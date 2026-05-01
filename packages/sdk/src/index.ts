// Public surface of the Verdict SDK.
export {
  getProgram,
  localProvider,
  VERDICT_PROGRAM_ID,
  type VerdictProgram,
} from "./program";

export {
  findDisputePda,
  findEscrowPda,
  findJurorPda,
  findVaultPda,
  findVotePda,
} from "./pdas";

export {
  castVoteIx,
  claimJurorRewardIx,
  initializeEscrowIx,
  raiseDisputeIx,
  registerJurorIx,
  releaseEscrowIx,
  resolveDisputeIx,
  type CastVoteArgs,
  type ClaimJurorRewardArgs,
  type InitializeEscrowArgs,
  type RaiseDisputeArgs,
  type ReleaseEscrowArgs,
  type ResolveDisputeArgs,
} from "./instructions";

export {
  DisputeOutcome,
  DisputeStatus,
  EscrowStatus,
  type Dispute,
  type Escrow,
  type Juror,
  type Vote,
} from "./shapes";

export type { Verdict } from "./types/verdict";
