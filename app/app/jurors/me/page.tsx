"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  claimJurorRewardIx,
  findVotePda,
  registerJurorIx,
  type Dispute,
} from "@/lib/verdict-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useJurorForWallet, useResolvedDisputes, type WithKey } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { explorerAccountUrl, explorerTxUrl } from "@/lib/config";

export default function JurorMePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const jurorQ = useJurorForWallet(wallet.publicKey ?? null);
  const resolvedQ = useResolvedDisputes();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  if (!wallet.publicKey) {
    return (
      <Section>
        <p className="text-sm text-indigo-800/80">Connect a wallet to register as a juror.</p>
      </Section>
    );
  }

  async function register() {
    if (!program || !wallet.publicKey) return;
    setBusy("register");
    setError(null);
    try {
      const ix = await registerJurorIx(program, wallet.publicKey);
      const sig = await sendTx({ connection, wallet, ixs: [ix] });
      setLastSig(sig);
      await qc.invalidateQueries({ queryKey: ["juror"] });
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function claim(dispute: PublicKey, label: string) {
    if (!program || !wallet.publicKey) return;
    setBusy(label);
    setError(null);
    try {
      const ix = await claimJurorRewardIx(program, {
        authority: wallet.publicKey,
        dispute,
      });
      const sig = await sendTx({ connection, wallet, ixs: [ix] });
      setLastSig(sig);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["juror"] }),
        qc.invalidateQueries({ queryKey: ["disputes:resolved"] }),
      ]);
    } catch (err) {
      setError(err instanceof TxError ? `${err.anchorCode ?? "tx"}: ${err.message}` : String(err));
    } finally {
      setBusy(null);
    }
  }

  const juror = jurorQ.data?.account;
  const jurorPda = jurorQ.data?.pda;

  return (
    <Section>
      {jurorQ.isLoading && <p className="text-sm">Loading juror state…</p>}
      {!jurorQ.isLoading && !juror && (
        <div className="space-y-3">
          <p className="text-sm text-indigo-800/85">
            You haven&apos;t registered yet. One transaction creates your Juror PDA — after
            that you can vote on any open dispute.
          </p>
          <button
            onClick={register}
            disabled={busy !== null}
            className="rounded bg-indigo-900 px-4 py-2 text-sm font-medium text-cream-50 hover:bg-indigo-800 disabled:opacity-50"
          >
            {busy === "register" ? "Registering…" : "Register as juror"}
          </button>
        </div>
      )}

      {!jurorQ.isLoading && juror && jurorPda && (
        <div className="space-y-6">
          <div className="grid gap-2 border border-cream-200 bg-white/60 p-5 shadow-sm">
            <h2 className="font-serif text-2xl">Juror</h2>
            <p className="text-sm text-indigo-800/80">
              <a
                className="font-mono text-xs underline"
                href={explorerAccountUrl(jurorPda.toBase58())}
                target="_blank"
                rel="noreferrer"
              >
                {jurorPda.toBase58()}
              </a>
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat k="Reputation" v={juror.reputation} />
              <Stat k="Cases voted" v={juror.casesVoted} />
              <Stat k="Active" v={juror.isActive ? "yes" : "no"} />
            </dl>
          </div>

          <div>
            <h3 className="font-serif text-xl">Resolved disputes</h3>
            <p className="text-xs text-indigo-800/80">
              You earn reputation +1 for each resolved dispute where your vote
              matched the panel outcome. Click <em>Claim</em> on any case where you
              voted to apply the credit.
            </p>
            <ul className="mt-3 grid gap-3">
              {resolvedQ.data?.length === 0 && (
                <li className="border border-cream-200 bg-white/40 p-4 text-sm text-indigo-800/80">
                  No resolved disputes yet.
                </li>
              )}
              {resolvedQ.data?.map((row) => (
                <ResolvedRow
                  key={row.publicKey.toBase58()}
                  row={row}
                  jurorPda={jurorPda}
                  busy={busy}
                  onClaim={() => claim(row.publicKey, row.publicKey.toBase58())}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
      )}
      {lastSig && (
        <p className="mt-4 text-xs">
          Last tx:{" "}
          <a className="font-mono underline" href={explorerTxUrl(lastSig)} target="_blank" rel="noreferrer">
            {lastSig.slice(0, 12)}…
          </a>
        </p>
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Article IV</p>
        <h1 className="font-serif text-4xl">Juror dossier</h1>
      </header>
      {children}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-indigo-800/70">{k}</div>
      <div className="font-serif text-2xl">{v}</div>
    </div>
  );
}

function ResolvedRow({
  row,
  jurorPda,
  busy,
  onClaim,
}: {
  row: WithKey<Dispute>;
  jurorPda: PublicKey;
  busy: string | null;
  onClaim: () => void;
}) {
  const program = useVerdictProgram();
  const { connection } = useConnection();
  const [voteState, setVoteState] = useState<"unknown" | "exists" | "claimed-or-not-voted">("unknown");

  // Lazily check whether this juror has a Vote PDA on this dispute. If not,
  // claim isn't applicable. We hit getAccountInfo once per row.
  // (The Vote PDA only exists between cast_vote and claim_juror_reward; absence
  // means either the juror never voted OR they already claimed.)
  // This is a lightweight per-row probe — no TanStack Query needed.
  if (program && voteState === "unknown") {
    const [votePda] = findVotePda(program.programId, row.publicKey, jurorPda);
    connection.getAccountInfo(votePda).then((info) => {
      setVoteState(info ? "exists" : "claimed-or-not-voted");
    });
  }

  const outcomeKey = Object.keys(row.account.outcome ?? {})[0] ?? "?";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border border-cream-200 bg-white/60 p-4 shadow-sm">
      <div className="grid gap-1">
        <span className="font-serif text-base">
          dispute{" "}
          <a
            className="font-mono text-xs underline"
            href={explorerAccountUrl(row.publicKey.toBase58())}
            target="_blank"
            rel="noreferrer"
          >
            {row.publicKey.toBase58().slice(0, 6)}…{row.publicKey.toBase58().slice(-4)}
          </a>
        </span>
        <span className="text-xs text-indigo-800/80">
          outcome: <strong>{outcomeKey}</strong> · refund {row.account.votesForRefund} / release{" "}
          {row.account.votesForRelease}
        </span>
      </div>
      {voteState === "exists" && (
        <button
          onClick={onClaim}
          disabled={busy !== null}
          className="rounded bg-gold-500 px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-gold-600 hover:text-cream-50 disabled:opacity-50"
        >
          {busy === row.publicKey.toBase58() ? "Claiming…" : "Claim reward"}
        </button>
      )}
      {voteState === "claimed-or-not-voted" && (
        <span className="text-xs text-indigo-800/60">No claim — already settled or didn&apos;t vote.</span>
      )}
    </li>
  );
}

export const dynamic = "force-dynamic";
