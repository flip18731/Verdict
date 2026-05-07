"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  DisputeOutcome,
  castVoteIx,
  findVaultPda,
  resolveDisputeIx,
} from "@/lib/verdict-sdk";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { explorerAccountUrl } from "@/lib/config";
import ConfirmModal from "./ConfirmModal";

type VoteChoice = "refund" | "release";

interface Props {
  disputePkStr: string;
}

export default function DisputeDetailLive({ disputePkStr }: Props) {
  // Re-derive the PublicKey here — class instances don't survive the server
  // boundary, so the parent route hands us the raw string.
  const disputePk = useMemo(() => new PublicKey(disputePkStr), [disputePkStr]);
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();

  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Pull the dispute account directly. We don't use the existing list query
  // because that returns Open disputes only — a resolved one would 404 here.
  const disputeQ = useQuery({
    queryKey: ["dispute:detail", disputePk.toBase58()],
    enabled: !!program,
    queryFn: async () => {
      if (!program) throw new Error("no program");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc = (await program.account.dispute.fetch(disputePk)) as any;
      return acc;
    },
  });

  // Fetch the linked escrow once we have the dispute (need it for resolve).
  const escrowPk = disputeQ.data?.escrow as PublicKey | undefined;
  const escrowQ = useQuery({
    queryKey: ["escrow:detail", escrowPk?.toBase58() ?? "none"],
    enabled: !!program && !!escrowPk,
    queryFn: async () => {
      if (!program || !escrowPk) throw new Error("no program");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc = (await program.account.escrow.fetch(escrowPk)) as any;
      return acc;
    },
  });

  const dispute = disputeQ.data;
  const escrow = escrowQ.data;

  // dispute.status is an Anchor enum: { open: {} } | { resolved: {} }
  const isResolved = !!dispute && "resolved" in (dispute.status as object);
  const votingEndsAt = dispute ? Number(dispute.votingEndsAt) : 0;
  const remaining = Math.max(0, votingEndsAt - now);
  const jurorsVoted = dispute ? Number(dispute.jurorsVoted) : 0;
  const jurorsSeated = dispute ? Number(dispute.jurorsSeated) : 3;
  const panelFull = jurorsVoted >= jurorsSeated;
  const canResolve = !isResolved && (remaining === 0 || panelFull);

  const timer = useMemo(() => {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [remaining]);

  async function executeVote() {
    if (!program || !wallet.publicKey || !pendingChoice) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const ix = await castVoteIx(program, {
        authority: wallet.publicKey,
        dispute: disputePk,
        choice:
          pendingChoice === "refund"
            ? DisputeOutcome.refund
            : DisputeOutcome.release,
      });
      await sendTx({ connection, wallet, ixs: [ix] });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dispute:detail", disputePk.toBase58()] }),
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
        qc.invalidateQueries({ queryKey: ["juror"] }),
      ]);
      setInfo(`Vote recorded: ${pendingChoice}.`);
      setPendingChoice(null);
    } catch (err) {
      setError(
        err instanceof TxError
          ? `${err.anchorCode ?? "tx"}: ${err.message}`
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  async function executeResolve() {
    if (!program || !wallet.publicKey || !escrow || !escrowPk) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const ixs: TransactionInstruction[] = [];
      const payer = escrow.payer as PublicKey;
      const merchant = escrow.merchant as PublicKey;
      const mint = escrow.mint as PublicKey;
      const payerAta = getAssociatedTokenAddressSync(mint, payer);
      const merchantAta = getAssociatedTokenAddressSync(mint, merchant);
      // Either ATA may not exist — bootstrap idempotently so resolve can
      // always credit the winner.
      for (const [owner, ata] of [
        [payer, payerAta] as const,
        [merchant, merchantAta] as const,
      ]) {
        const info = await connection.getAccountInfo(ata);
        if (!info) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              ata,
              owner,
              mint,
              TOKEN_PROGRAM_ID,
            ),
          );
        }
      }
      const [vault] = findVaultPda(program.programId, escrowPk);
      ixs.push(
        await resolveDisputeIx(program, {
          caller: wallet.publicKey,
          escrow: escrowPk,
          dispute: disputePk,
          vault,
          payerTokenAccount: payerAta,
          merchantTokenAccount: merchantAta,
          payerRentRecipient: payer,
        }),
      );
      await sendTx({ connection, wallet, ixs });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dispute:detail", disputePk.toBase58()] }),
        qc.invalidateQueries({ queryKey: ["escrow:detail", escrowPk.toBase58()] }),
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
        qc.invalidateQueries({ queryKey: ["disputes:resolved"] }),
        qc.invalidateQueries({ queryKey: ["escrows"] }),
      ]);
      setInfo("Verdict rendered. Vault settled atomically.");
      setConfirmingResolve(false);
    } catch (err) {
      setError(
        err instanceof TxError
          ? `${err.anchorCode ?? "tx"}: ${err.message}`
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!wallet.publicKey) {
    return (
      <>
        <div className="page-header">
          <div>
            <Link href="/disputes" className="page-back">
              ← Disputes
            </Link>
            <div className="page-title">Dispute · {disputePk.toBase58().slice(0, 8)}…</div>
            <div className="page-subtitle">Connect a wallet to vote</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setVisible(true)}>
            Connect wallet
          </button>
        </div>
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
          Connect a wallet to view the case file and cast your vote.
        </div>
      </>
    );
  }

  if (disputeQ.isLoading || (escrowPk && escrowQ.isLoading)) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
        Loading case file from chain…
      </div>
    );
  }
  if (disputeQ.error || !dispute) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--red)" }}>
        Could not load this dispute. {(disputeQ.error as Error)?.message ?? ""}
      </div>
    );
  }

  const tally = `${dispute.votesForRefund} refund · ${dispute.votesForRelease} release`;
  const status = isResolved ? "Resolved" : "Open";

  return (
    <>
      <div className="page-header">
        <div>
          <Link href="/disputes" className="page-back">
            ← Disputes
          </Link>
          <div className="page-title">
            Dispute · {disputePk.toBase58().slice(0, 8)}…
          </div>
          <div className="page-subtitle">
            {status} · {tally} · {jurorsVoted}/{jurorsSeated} voted
          </div>
        </div>
        <span className={isResolved ? "badge badge-green" : "badge badge-gold"}>
          <span className="badge-dot" />
          {isResolved ? "Resolved" : "Awaiting verdict"}
        </span>
      </div>

      {error ? <Banner kind="error" text={error} /> : null}
      {info ? <Banner kind="success" text={info} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          background: "var(--bg-2)",
        }}
      >
        <div className="detail-wrap">
          {/* Timer */}
          <div className="timer-card">
            <div>
              <div className="timer-label">
                {isResolved ? "Voting closed" : "Voting closes in"}
              </div>
              <div className="timer-val">{isResolved ? "—" : timer}</div>
            </div>
            <div className="timer-right">
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                Panel progress
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-mono), monospace",
                  fontWeight: 500,
                }}
              >
                {jurorsVoted} / {jurorsSeated} voted
              </div>
              <div className="timer-progress">
                <div
                  className="timer-progress-fill"
                  style={{ width: `${(jurorsVoted / jurorsSeated) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Case file */}
          <div className="case-card">
            <div className="case-card-header">
              <div>
                <div className="case-id">
                  Case № {disputePk.toBase58().slice(0, 8)}…
                </div>
                <div className="case-title">
                  {escrow
                    ? `${(escrow.payer as PublicKey).toBase58().slice(0, 6)} → ${(escrow.merchant as PublicKey).toBase58().slice(0, 6)}`
                    : "Loading…"}
                </div>
              </div>
              <div className="case-amount">
                {escrow
                  ? `${(Number(escrow.amount) / 1e6).toFixed(2)}`
                  : "—"}
                <span className="case-amount-sub"> USDC</span>
              </div>
            </div>
            <div className="case-body">
              {escrow ? (
                <div className="case-grid">
                  <Field
                    label="Petitioner"
                    value={(escrow.payer as PublicKey).toBase58()}
                    mono
                    href={explorerAccountUrl((escrow.payer as PublicKey).toBase58())}
                  />
                  <Field
                    label="Respondent"
                    value={(escrow.merchant as PublicKey).toBase58()}
                    mono
                    href={explorerAccountUrl((escrow.merchant as PublicKey).toBase58())}
                  />
                  <Field
                    label="Vault"
                    value={(escrow.vault as PublicKey).toBase58()}
                    mono
                    dim
                    href={explorerAccountUrl((escrow.vault as PublicKey).toBase58())}
                  />
                  <Field
                    label="Status"
                    value={
                      "disputed" in (escrow.status as object)
                        ? "Disputed"
                        : "released" in (escrow.status as object)
                          ? "Released"
                          : "refunded" in (escrow.status as object)
                            ? "Refunded"
                            : "Funded"
                    }
                  />
                </div>
              ) : null}
              <div className="evidence-box">
                <div className="evidence-label">Evidence URI</div>
                <div className="evidence-uri">
                  {dispute.evidenceUri || "(none provided)"}
                </div>
              </div>
            </div>
          </div>

          {/* Vote / Resolve actions */}
          {!isResolved ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <button
                className="vote-btn refund"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-sm)",
                  padding: "20px 24px",
                  textAlign: "left",
                  cursor: panelFull || remaining === 0 ? "not-allowed" : "pointer",
                  opacity: panelFull || remaining === 0 ? 0.5 : 1,
                }}
                onClick={() => setPendingChoice("refund")}
                disabled={busy || panelFull || remaining === 0}
              >
                <div className="vote-btn-label">↩ Refund petitioner</div>
                <div className="vote-btn-desc">
                  Return{" "}
                  {escrow
                    ? `${(Number(escrow.amount) / 1e6).toFixed(2)} USDC`
                    : "the vault"}{" "}
                  to payer
                </div>
              </button>
              <button
                className="vote-btn release"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-sm)",
                  padding: "20px 24px",
                  textAlign: "left",
                  cursor: panelFull || remaining === 0 ? "not-allowed" : "pointer",
                  opacity: panelFull || remaining === 0 ? 0.5 : 1,
                }}
                onClick={() => setPendingChoice("release")}
                disabled={busy || panelFull || remaining === 0}
              >
                <div className="vote-btn-label">↗ Release to merchant</div>
                <div className="vote-btn-desc">
                  Deliver{" "}
                  {escrow
                    ? `${(Number(escrow.amount) / 1e6).toFixed(2)} USDC`
                    : "the vault"}{" "}
                  to respondent
                </div>
              </button>
            </div>
          ) : null}

          {canResolve ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginBottom: 16,
                padding: "16px 24px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  marginRight: "auto",
                  fontSize: 13,
                  color: "var(--text-2)",
                }}
              >
                {panelFull
                  ? "Panel is full. Verdict can be rendered now."
                  : "Voting window closed. Verdict can be rendered now."}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setConfirmingResolve(true)}
                disabled={busy}
              >
                {busy ? "Sealing…" : "Render verdict"}
              </button>
            </div>
          ) : null}

          {isResolved ? (
            <div
              className="verdict-announcement"
              style={{ borderRadius: 12, border: "1px solid var(--gold-border)" }}
            >
              <div className="verdict-eyebrow">⚖ Verdict rendered</div>
              <div className="verdict-text">
                {dispute.outcome && "refund" in (dispute.outcome as object)
                  ? "Refund — funds returned to petitioner"
                  : "Release — funds delivered to merchant"}
              </div>
              <div className="verdict-sub">
                {dispute.votesForRefund} refund · {dispute.votesForRelease} release · escrow settled on-chain
              </div>
            </div>
          ) : null}
        </div>

        <aside className="layout-side" style={{ borderTop: "none" }}>
          <div className="side-section">
            <div className="side-label">Dispute details</div>
            <SideMetric
              label="PDA"
              value={`${disputePk.toBase58().slice(0, 4)}…${disputePk.toBase58().slice(-4)}`}
            />
            <SideMetric
              label="Tally"
              value={`${dispute.votesForRefund} / ${dispute.votesForRelease}`}
            />
            <SideMetric label="Panel" value={`${jurorsSeated} jurors`} />
            <SideMetric label="Tie-break" value="Release" />
          </div>
        </aside>
      </div>

      <ConfirmModal
        open={pendingChoice !== null}
        title={`Confirm vote: ${pendingChoice ?? ""}`}
        body={
          <>
            This will permanently record your vote on Solana — your decision
            cannot be changed. If you vote with the majority, you earn{" "}
            <strong>+1 reputation</strong>.
          </>
        }
        confirmLabel={`Confirm ${pendingChoice ?? ""}`}
        onConfirm={executeVote}
        onCancel={() => setPendingChoice(null)}
        busy={busy}
      />

      <ConfirmModal
        open={confirmingResolve}
        title="Render the verdict"
        body={
          <>
            This tallies the panel&rsquo;s votes and atomically settles the
            escrow on-chain. Once rendered, the verdict is final — there is no
            appeal.
          </>
        }
        confirmLabel="Render verdict"
        onConfirm={executeResolve}
        onCancel={() => setConfirmingResolve(false)}
        busy={busy}
      />
    </>
  );
}

function Banner({
  kind,
  text,
}: {
  kind: "error" | "success";
  text: React.ReactNode;
}) {
  const c =
    kind === "error"
      ? { bg: "var(--red-bg)", border: "var(--red-border)", text: "var(--red)" }
      : {
          bg: "var(--green-bg)",
          border: "var(--green-border)",
          text: "var(--green)",
        };
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        padding: "10px 16px",
        margin: "16px 24px 0",
        borderRadius: 8,
        fontSize: 13,
        fontFamily:
          kind === "error" ? "var(--font-mono), monospace" : "inherit",
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  dim,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  dim?: boolean;
  href?: string;
}) {
  const valueNode = mono ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <div>
      <div className="case-field-label">{label}</div>
      <div
        className={`case-field-val${mono ? " mono" : ""}`}
        style={dim ? { color: "var(--text-3)" } : undefined}
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {valueNode}
          </a>
        ) : (
          valueNode
        )}
      </div>
    </div>
  );
}

function SideMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="side-metric">
      <span className="side-metric-label">{label}</span>
      <span className="side-metric-val">{value}</span>
    </div>
  );
}
