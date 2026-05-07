import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/verdict.json";
import type { Verdict } from "./types/verdict";

export type VerdictProgram = Program<Verdict>;

/**
 * Build a typed `Program<Verdict>` from a connected provider.
 * The IDL is bundled with the SDK so callers never need to know the program ID
 * or fetch the IDL from chain. To use this with a different deployment of the
 * Verdict program, mutate idl.address — but the canonical, in-tree program ID
 * is the one in `idl/verdict.json` at SDK-build time.
 */
export function getProgram(provider: AnchorProvider): VerdictProgram {
  return new Program<Verdict>(idl as Verdict, provider);
}

/** The on-chain program ID baked into the bundled IDL. */
export const VERDICT_PROGRAM_ID: PublicKey = new PublicKey(
  (idl as { address: string }).address,
);

/**
 * Build an AnchorProvider from a connection + wallet (for Node smoke tests).
 *
 * AnchorProvider.defaultOptions() returns { commitment: 'processed' }, which
 * confirms transactions BEFORE they're visible to subsequent reads at
 * 'confirmed' commitment. We override to 'confirmed' so post-tx state reads
 * are deterministic in tests and demo scripts.
 */
export function localProvider(connection: Connection, wallet: AnchorProvider["wallet"]): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}
