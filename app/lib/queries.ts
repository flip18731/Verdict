"use client";

import { useQuery } from "@tanstack/react-query";
import { type AccountInfo, PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  findJurorPda,
  type Dispute,
  type Escrow,
  type Juror,
} from "verdict-sdk";
import { useVerdictProgram } from "./useVerdictProgram";

// All on-chain account types come back as Anchor's stripped representation
// (no AccountInfo metadata). Pair them with their pubkey so the UI can link
// to explorer + key by it.
export interface WithKey<T> {
  publicKey: PublicKey;
  account: T;
}

// ---------- Escrows the connected wallet has skin in ----------

export function useEscrowsForWallet(wallet: PublicKey | null) {
  const program = useVerdictProgram();
  return useQuery({
    queryKey: ["escrows", wallet?.toBase58() ?? "anon"],
    enabled: !!program && !!wallet,
    queryFn: async (): Promise<WithKey<Escrow>[]> => {
      if (!program || !wallet) return [];
      // Memcmp: payer field. 8 = anchor discriminator, then 1 (bump) + 8 (escrow_id).
      const PAYER_OFFSET = 8 + 1 + 8;
      const MERCHANT_OFFSET = PAYER_OFFSET + 32;
      const [asPayer, asMerchant] = await Promise.all([
        program.account.escrow.all([
          { memcmp: { offset: PAYER_OFFSET, bytes: wallet.toBase58() } },
        ]),
        program.account.escrow.all([
          { memcmp: { offset: MERCHANT_OFFSET, bytes: wallet.toBase58() } },
        ]),
      ]);
      const merged = new Map<string, WithKey<Escrow>>();
      for (const e of [...asPayer, ...asMerchant]) {
        merged.set(e.publicKey.toBase58(), e as WithKey<Escrow>);
      }
      return Array.from(merged.values()).sort(
        (a, b) => Number(b.account.createdAt) - Number(a.account.createdAt),
      );
    },
  });
}

// ---------- All open disputes ----------

export function useOpenDisputes() {
  const program = useVerdictProgram();
  return useQuery({
    queryKey: ["disputes:open"],
    enabled: !!program,
    queryFn: async (): Promise<WithKey<Dispute>[]> => {
      if (!program) return [];
      const all = await program.account.dispute.all();
      return (all as WithKey<Dispute>[]).filter(
        (d) => "open" in (d.account.status as object),
      );
    },
  });
}

// ---------- All resolved disputes (for juror reward claiming) ----------

export function useResolvedDisputes() {
  const program = useVerdictProgram();
  return useQuery({
    queryKey: ["disputes:resolved"],
    enabled: !!program,
    queryFn: async (): Promise<WithKey<Dispute>[]> => {
      if (!program) return [];
      const all = await program.account.dispute.all();
      return (all as WithKey<Dispute>[]).filter(
        (d) => "resolved" in (d.account.status as object),
      );
    },
  });
}

// ---------- The connected wallet's juror account, if registered ----------

export function useJurorForWallet(wallet: PublicKey | null) {
  const { connection } = useConnection();
  const program = useVerdictProgram();
  return useQuery({
    queryKey: ["juror", wallet?.toBase58() ?? "anon"],
    enabled: !!program && !!wallet,
    queryFn: async (): Promise<{
      pda: PublicKey;
      account: Juror | null;
      info: AccountInfo<Buffer> | null;
    }> => {
      if (!program || !wallet) throw new Error("unreachable");
      const [pda] = findJurorPda(program.programId, wallet);
      const info = await connection.getAccountInfo(pda, "confirmed");
      if (!info) return { pda, account: null, info: null };
      const account = (await program.account.juror.fetch(pda)) as Juror;
      return { pda, account, info };
    },
  });
}
