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
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();

  const disputePk = useMemo(() => new PublicKey(disputePkStr), [disputePkStr]);

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
        choice: pendingChoice === "refund" ? DisputeOutcome.refund : DisputeOutcome.release,
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
      for (const [owner, ata] of [
        [payer, payerAta] as const,
        [merchant, merchantAta] as const,
      ]) {
        const accInfo = await connection.getAccountInfo(ata);
        if (!accInfo) {
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
        <div className="v-page-header">
          <div>
            <Link href="/disputes" className="v-page-back">
              ← Disputes
            </Link>
            <div className="v-page-title">
              Dispute · <span className="v-mono">{disputePk.toBase58().slice(0, 8)}…</span>
            </div>
            <div className="v-page-subtitle">Connect a wallet to vote</div>
          </div>
          <button className="v-btn v-btn-primary v-btn-sm" onClick={() => setVisible(true)}>
            Connect wallet
          </button>
        </div>
        <div className="v-empty">
          Connect a wallet to view the case file and cast your vote.
        </div>
      </>
    );
  }

  if (disputeQ.isLoading || (escrowPk && escrowQ.isLoading)) {
    return <div className="v-empty">Loading case file from chain…</div>;
  }
  if (disputeQ.error || !dispute) {
    return (
      <div className="v-empty" style={{ color: "var(--red)" }}>
        Could not load this dispute. {(disputeQ.error as Error)?.message ?? ""}
      </div>
    );
  }

  const tally = `${dispute.votesForRefund} refund · ${dispute.votesForRelease} release`;
  const status = isResolved ? "Resolved" : "Open";

  return (
    <>
      <div className="v-page-header">
        <div>
          <Link href="/disputes" className="v-page-back">
            ← Disputes
          </Link>
          <div className="v-page-title">
            Dispute · <span className="v-mono">{disputePk.toBase58().slice(0, 8)}…</span>
          </div>
          <div className="v-page-subtitle">
            {status} · {tally} · {jurorsVoted}/{jurorsSeated} voted
          </div>
        </div>
        <span className={isResolved ? "v-badge v-badge-green" : "v-badge v-badge-gold"}>
          <span className="v-badge-dot" />
          {isResolved ? "Resolved" : "Awaiting verdict"}
        </span>
      </div>

      {error ? <Banner kind="error" text={error} /> : null}
      {info ? <Banner kind="success" text={info} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          background: "var(--bg-subtle)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, width: "100%" }}>
          {/* Timer */}
          <div
            className="v-card v-card-lg"
            style={{
              padding: "20px 24px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  marginBottom: 4,
                }}
              >
                {isResolved ? "Voting closed" : "Voting closes in"}
              </div>
              <div
                className="v-mono"
                style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.5px" }}
              >
                {isResolved ? "—" : timer}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                Panel progress
              </div>
              <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                {jurorsVoted} / {jurorsSeated} voted
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 4,
                  background: "var(--bg-muted)",
                  borderRadius: 2,
                  width: 120,
                  marginLeft: "auto",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: "var(--gold)",
                    borderRadius: 2,
                    width: `${(jurorsVoted / jurorsSeated) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Case file */}
          <div className="v-card v-card-lg" style={{ marginBottom: 16, overflow: "hidden" }}>
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div>
                <div
                  className="v-mono"
                  style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}
                >
                  Case № {disputePk.toBase58().slice(0, 8)}…
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.3px" }}>
                  {escrow
                    ? `${(escrow.payer as PublicKey).toBase58().slice(0, 6)} → ${(escrow.merchant as PublicKey).toBase58().slice(0, 6)}`
                    : "Loading…"}
                </div>
              </div>
              <div
                className="v-mono"
                style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.5px" }}
              >
                {escrow ? `${(Number(escrow.amount) / 1e6).toFixed(2)}` : "—"}
                <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 400 }}>
                  {" "}
                  USDC
                </span>
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {escrow ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
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
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "12px 14px",
                  marginTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    marginBottom: 6,
                  }}
                >
                  Evidence URI
                </div>
                <div
                  className="v-mono"
                  style={{ fontSize: 12.5, color: "var(--text-2)", wordBreak: "break-all" }}
                >
                  {dispute.evidenceUri || "(none provided)"}
                </div>
              </div>
            </div>
          </div>

          {/* Vote actions */}
          {!isResolved ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <VoteButton
                label="↩ Refund petitioner"
                desc={`Return ${escrow ? (Number(escrow.amount) / 1e6).toFixed(2) + " USDC" : "the vault"} to payer`}
                tone="refund"
                onClick={() => setPendingChoice("refund")}
                disabled={busy || panelFull || remaining === 0}
              />
              <VoteButton
                label="↗ Release to merchant"
                desc={`Deliver ${escrow ? (Number(escrow.amount) / 1e6).toFixed(2) + " USDC" : "the vault"} to respondent`}
                tone="release"
                onClick={() => setPendingChoice("release")}
                disabled={busy || panelFull || remaining === 0}
              />
            </div>
          ) : null}

          {canResolve ? (
            <div
              className="v-card v-card-lg"
              style={{
                padding: "16px 24px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ marginRight: "auto", fontSize: 13, color: "var(--text-2)" }}>
                {panelFull
                  ? "Panel is full. Verdict can be rendered now."
                  : "Voting window closed. Verdict can be rendered now."}
              </div>
              <button
                className="v-btn v-btn-primary"
                onClick={() => setConfirmingResolve(true)}
                disabled={busy}
              >
                {busy ? "Sealing…" : "Render verdict"}
              </button>
            </div>
          ) : null}

          {isResolved ? (
            <div
              className="v-card v-card-lg"
              style={{
                background: "var(--gold-bg)",
                border: "1px solid var(--gold-border)",
                padding: 28,
                textAlign: "center",
              }}
            >
              <div
                className="v-mono"
                style={{
                  fontSize: 12,
                  color: "var(--gold)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  marginBottom: 4,
                }}
              >
                ⚖ Verdict rendered
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                {dispute.outcome && "refund" in (dispute.outcome as object)
                  ? "Refund — funds returned to petitioner"
                  : "Release — funds delivered to merchant"}
              </div>
              <div className="v-mono" style={{ fontSize: 13, color: "var(--text-2)" }}>
                {dispute.votesForRefund} refund · {dispute.votesForRelease} release · escrow settled on-chain
              </div>
            </div>
          ) : null}
        </div>

        <aside className="v-layout-side" style={{ borderTop: "none" }}>
          <div>
            <div className="v-side-label">Dispute details</div>
            <SideRow
              label="PDA"
              value={`${disputePk.toBase58().slice(0, 4)}…${disputePk.toBase58().slice(-4)}`}
            />
            <SideRow
              label="Tally"
              value={`${dispute.votesForRefund} / ${dispute.votesForRelease}`}
            />
            <SideRow label="Panel" value={`${jurorsSeated} jurors`} />
            <SideRow label="Tie-break" value="Release" />
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
            escrow on-chain. Once rendered, the verdict is final — there is no appeal.
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

function VoteButton({
  label,
  desc,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  desc: string;
  tone: "refund" | "release";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="v-card v-card-lg"
      style={{
        padding: "20px 24px",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 2,
          color: tone === "refund" ? "var(--gold)" : "var(--blue)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{desc}</div>
    </button>
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
        fontFamily: kind === "error" ? "var(--font-mono), monospace" : "inherit",
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
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-3)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? "v-mono" : ""}
        style={{
          fontSize: mono ? 13 : 14,
          color: dim ? "var(--text-3)" : "var(--text-1)",
        }}
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

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="v-side-row">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span className="v-mono" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
