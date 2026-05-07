"use client";

import { useMemo } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { getProgram, type VerdictProgram } from "@/lib/verdict-sdk";

// Returns the typed Verdict program when a wallet is connected, or null when
// the user hasn't connected yet. Components that need the program should
// short-circuit on null and prompt for connection.
export function useVerdictProgram(): VerdictProgram | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return getProgram(provider);
  }, [connection, wallet]);
}
