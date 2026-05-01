"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  DisputeOutcome,
  castVoteIx,
  resolveDisputeIx,
  type Dispute,
} from "verdict-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useOpenDisputes, type WithKey } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { explorerAccountUrl, explorerTxUrl } from "@/lib/config";

export default function DisputesPage() {
  const { data, isLoading, error } = useOpenDisputes();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Article III</p>
        <h1 className="font-serif text-4xl">Open disputes</h1>
        <p className="text-sm text-indigo-800/85">
          Every dispute with voting still in session. Three-juror panel. Tie
          defaults to release (merchant wins).
        </p>
      </header>

      {isLoading && <Empty>Loading…</Empty>}
      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          {(error as Error).message}
        </div>
      )}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Empty>No open disputes.</Empty>
      )}
      <ul className="grid gap-4">
        {data?.map((row) => (
          <DisputeCard key={row.publicKey.toBase58()} row={row} />
        ))}
      </ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-cream-200 bg-white/40 p-6 text-sm text-indigo-800/80">{children}</div>;
}

function DisputeCard({ row }: { row: WithKey<Dispute> }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"refund" | "release" | "resolve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const { account } = row;
  const endsAt = Number(account.votingEndsAt);
  const remaining = Math.max(0, endsAt - now);
  const panelFull = account.jurorsVoted >= account.jurorsSeated;
  const canResolve = remaining === 0 || panelFull;

  async function vote(choice: "refund" | "release") {
    if (!program || !wallet.publicKey) return;
    setBusy(choice);
    setError(null);
    try {
      const ix = await castVoteIx(program, {
        authority: wallet.publicKey,
        dispute: row.publicKey,
        choice: choice === "refund" ? DisputeOutcome.refund : DisputeOutcome.release,
      });
      const sig = await sendTx({ connection, wallet, ixs: [ix] });
      setLastSig(sig);
      await qc.invalidateQueries({ queryKey: ["disputes:open"] });
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function resolve() {
    if (!program || !wallet.publicKey) return;
    setBusy("resolve");
    setError(null);
    try {
      // Need the escrow to know payer/merchant + their token accounts.
      const escrowAccount = await program.account.escrow.fetch(account.escrow);
      const payerAta = getAssociatedTokenAddressSync(escrowAccount.mint, escrowAccount.payer);
      const merchantAta = getAssociatedTokenAddressSync(escrowAccount.mint, escrowAccount.merchant);
      const ixs = [];
      // Idempotent: create either ATA if missing so resolve can always credit.
      for (const [owner, ata] of [
        [escrowAccount.payer, payerAta] as const,
        [escrowAccount.merchant, merchantAta] as const,
      ]) {
        const info = await connection.getAccountInfo(ata);
        if (!info) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              ata,
              owner,
              escrowAccount.mint,
              TOKEN_PROGRAM_ID,
            ),
          );
        }
      }
      ixs.push(
        await resolveDisputeIx(program, {
          caller: wallet.publicKey,
          escrow: account.escrow,
          dispute: row.publicKey,
          vault: escrowAccount.vault,
          payerTokenAccount: payerAta,
          merchantTokenAccount: merchantAta,
          payerRentRecipient: escrowAccount.payer,
        }),
      );
      const sig = await sendTx({ connection, wallet, ixs });
      setLastSig(sig);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
        qc.invalidateQueries({ queryKey: ["disputes:resolved"] }),
        qc.invalidateQueries({ queryKey: ["escrows"] }),
      ]);
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  const evidenceHref = renderEvidence(account.evidenceUri);

  return (
    <li className="border border-cream-200 bg-white/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg">
          Dispute on escrow{" "}
          <a
            className="font-mono text-sm underline"
            href={explorerAccountUrl(account.escrow.toBase58())}
            target="_blank"
            rel="noreferrer"
          >
            {account.escrow.toBase58().slice(0, 6)}…{account.escrow.toBase58().slice(-4)}
          </a>
        </h3>
        <span className="text-xs uppercase tracking-wider text-indigo-800/80">
          {account.jurorsVoted} of {account.jurorsSeated} voted
        </span>
      </div>
      <p className="mt-2 text-xs text-indigo-800/80">
        evidence:{" "}
        {evidenceHref ? (
          <a className="break-all font-mono underline" href={evidenceHref} target="_blank" rel="noreferrer">
            {account.evidenceUri}
          </a>
        ) : (
          <span className="break-all font-mono">{account.evidenceUri || "(none)"}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-indigo-800/80">
        tally — refund: {account.votesForRefund} · release: {account.votesForRelease}
      </p>
      <p className="mt-1 text-xs text-indigo-800/80">
        {remaining > 0 ? `voting ends in ${remaining}s` : "voting window closed"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => vote("refund")}
          disabled={!wallet.publicKey || busy !== null || panelFull || remaining === 0}
          className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream-50 hover:bg-rose-800 disabled:opacity-50"
        >
          {busy === "refund" ? "Voting…" : "Vote: refund"}
        </button>
        <button
          onClick={() => vote("release")}
          disabled={!wallet.publicKey || busy !== null || panelFull || remaining === 0}
          className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream-50 hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy === "release" ? "Voting…" : "Vote: release"}
        </button>
        <button
          onClick={resolve}
          disabled={!wallet.publicKey || busy !== null || !canResolve}
          className="rounded bg-indigo-900 px-3 py-1.5 text-xs font-medium text-cream-50 hover:bg-indigo-800 disabled:opacity-50"
        >
          {busy === "resolve" ? "Resolving…" : "Resolve"}
        </button>
      </div>
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

// Render evidence URI as a clickable link if it's an http/ipfs/arweave URI.
// ipfs:// gets rewritten through a public gateway so the link actually opens.
function renderEvidence(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("https://") || uri.startsWith("http://")) return uri;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  if (uri.startsWith("arweave://") || uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.replace(/^(arweave:\/\/|ar:\/\/)/, "")}`;
  }
  return null;
}

export const dynamic = "force-dynamic";
