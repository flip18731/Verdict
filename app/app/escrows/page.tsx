"use client";

import Link from "next/link";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  raiseDisputeIx,
  releaseEscrowIx,
  type Escrow,
} from "verdict-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useEscrowsForWallet, type WithKey } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { StatusBadge } from "@/components/StatusBadge";
import { explorerAccountUrl, explorerTxUrl } from "@/lib/config";

export default function EscrowsPage() {
  const wallet = useWallet();
  const { data, isLoading, error } = useEscrowsForWallet(wallet.publicKey ?? null);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Article II</p>
        <h1 className="font-serif text-4xl">My escrows</h1>
        <p className="text-sm text-indigo-800/85">
          Every escrow where you are payer or merchant. Status determines what
          actions are available.
        </p>
      </header>

      {!wallet.publicKey && (
        <Empty>Connect a wallet to see your escrows.</Empty>
      )}
      {wallet.publicKey && isLoading && <Empty>Loading…</Empty>}
      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          {(error as Error).message}
        </div>
      )}
      {wallet.publicKey && !isLoading && (data?.length ?? 0) === 0 && (
        <Empty>
          No escrows yet.{" "}
          <Link href="/escrows/new" className="underline">
            Open one
          </Link>
          .
        </Empty>
      )}

      <ul className="grid gap-4">
        {data?.map((row) => (
          <EscrowCard key={row.publicKey.toBase58()} row={row} viewer={wallet.publicKey!} />
        ))}
      </ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-cream-200 bg-white/40 p-6 text-sm text-indigo-800/80">{children}</div>;
}

function EscrowCard({ row, viewer }: { row: WithKey<Escrow>; viewer: PublicKey }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"release" | "dispute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const { account } = row;
  const isPayer = viewer.equals(account.payer);
  const role = isPayer ? "payer" : viewer.equals(account.merchant) ? "merchant" : "observer";
  const counterparty = isPayer ? account.merchant : account.payer;
  const isFunded = "funded" in (account.status as object);
  const isDisputed = "disputed" in (account.status as object);

  async function release() {
    if (!program || !wallet.publicKey) return;
    setBusy("release");
    setError(null);
    try {
      const merchantAta = getAssociatedTokenAddressSync(account.mint, account.merchant);
      const ataInfo = await connection.getAccountInfo(merchantAta);
      const ixs = [];
      if (!ataInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            merchantAta,
            account.merchant,
            account.mint,
            TOKEN_PROGRAM_ID,
          ),
        );
      }
      ixs.push(
        await releaseEscrowIx(program, {
          payer: wallet.publicKey,
          escrow: row.publicKey,
          vault: account.vault,
          merchantTokenAccount: merchantAta,
        }),
      );
      const sig = await sendTx({ connection, wallet, ixs });
      setLastSig(sig);
      await qc.invalidateQueries({ queryKey: ["escrows"] });
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function dispute() {
    if (!program || !wallet.publicKey) return;
    setBusy("dispute");
    setError(null);
    try {
      const ix = await raiseDisputeIx(program, {
        payer: wallet.publicKey,
        escrow: row.publicKey,
        evidenceUri: window.prompt("Evidence URI (ipfs://, arweave://, https://):", "ipfs://demo-evidence") ?? "",
        votingWindowSeconds: new BN(120),
      });
      const sig = await sendTx({ connection, wallet, ixs: [ix] });
      setLastSig(sig);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["escrows"] }),
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
      ]);
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="border border-cream-200 bg-white/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-x-2">
          <span className="font-serif text-lg">
            {fmtAmount(account.amount)} <span className="text-xs text-indigo-800/70">USDC*</span>
          </span>
          <StatusBadge status={account.status} />
          <span className="text-xs uppercase tracking-wider text-indigo-800/70">role: {role}</span>
        </div>
        <a
          href={explorerAccountUrl(row.publicKey.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-indigo-800/70 underline"
        >
          {row.publicKey.toBase58().slice(0, 6)}…{row.publicKey.toBase58().slice(-4)}
        </a>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-indigo-800/85">
        <Row k="counterparty" v={counterparty.toBase58()} />
        <Row k="vault" v={account.vault.toBase58()} />
        <Row k="created" v={new Date(Number(account.createdAt) * 1000).toLocaleString()} />
      </div>

      {(isFunded || isDisputed) && isPayer && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isFunded && (
            <button
              onClick={release}
              disabled={busy !== null}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream-50 hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy === "release" ? "Releasing…" : "Release to merchant"}
            </button>
          )}
          {isFunded && (
            <button
              onClick={dispute}
              disabled={busy !== null}
              className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-cream-50 hover:bg-amber-800 disabled:opacity-50"
            >
              {busy === "dispute" ? "Filing…" : "Raise dispute"}
            </button>
          )}
          {isDisputed && (
            <Link
              href="/disputes"
              className="rounded border border-indigo-900 px-3 py-1.5 text-xs font-medium hover:bg-indigo-900 hover:text-cream-50"
            >
              View dispute
            </Link>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
      {lastSig && (
        <p className="mt-3 text-xs">
          Last tx:{" "}
          <a className="font-mono underline" href={explorerTxUrl(lastSig)} target="_blank" rel="noreferrer">
            {lastSig.slice(0, 12)}…
          </a>
        </p>
      )}
    </li>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="uppercase tracking-wider opacity-70">{k}</span>
      <span className="break-all font-mono">{v}</span>
    </div>
  );
}

function fmtAmount(amount: bigint | { toString(): string } | number): string {
  // u64 BN comes through as @coral-xyz/anchor BN; toString() is safe.
  // Use the BigInt() constructor instead of literals — the bundled tsc version
  // misreports the target lib here.
  const raw = BigInt(amount.toString());
  const SCALE = BigInt(1_000_000); // 6 decimals
  const whole = raw / SCALE;
  const frac = (raw % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export const dynamic = "force-dynamic";
