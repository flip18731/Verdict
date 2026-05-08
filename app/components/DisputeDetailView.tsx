"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "./ConfirmModal";

type VoteChoice = "refund" | "release";

interface JurorRow {
  letter: string;
  name: string;
  rep: string;
  tier: string;
  vote: VoteChoice | null;
  you: boolean;
}

const INITIAL_JURORS: JurorRow[] = [
  { letter: "You", name: "4xKpT…9wRq", rep: "REP 847", tier: "Tier II", vote: null, you: true },
  { letter: "B", name: "Bq4T…9wLk", rep: "REP 1,240", tier: "Tier III", vote: "refund", you: false },
  { letter: "M", name: "Mn7R…3kPx", rep: "REP 562", tier: "Tier I", vote: null, you: false },
];

interface Props {
  disputeId: string;
}

export default function DisputeDetailView({ disputeId }: Props) {
  const [voted, setVoted] = useState<VoteChoice | null>(null);
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const [resolving, setResolving] = useState(false);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [jurors, setJurors] = useState<JurorRow[]>(INITIAL_JURORS);
  const [secondsLeft, setSecondsLeft] = useState(3 * 3600 + 42 * 60 + 17);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const timer = useMemo(() => {
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  const votedCount = jurors.filter((j) => j.vote !== null).length;

  const requestVote = (c: VoteChoice) => {
    if (voted || resolving || resolved) return;
    setPendingChoice(c);
  };

  const confirmVote = () => {
    if (!pendingChoice) return;
    setVoted(pendingChoice);
    setJurors((prev) => prev.map((j) => (j.you ? { ...j, vote: pendingChoice } : j)));
    setPendingChoice(null);
  };

  const requestResolve = () => {
    if (!voted || resolving || resolved) return;
    setConfirmingResolve(true);
  };

  const confirmResolve = () => {
    setConfirmingResolve(false);
    setResolving(true);
    setTimeout(() => {
      setResolving(false);
      setResolved(true);
    }, 1800);
  };

  const verdictText =
    voted === "refund"
      ? "Refund — $2,500 USDC returned to petitioner"
      : "Release — $2,500 USDC delivered to merchant";
  const verdictSub = `2 of 3 jurors voted ${voted ?? "refund"} · escrow released onchain`;

  return (
    <>
      <div className="v-page-header">
        <div>
          <Link href="/disputes" className="v-page-back">
            ← Disputes
          </Link>
          <div className="v-page-title">{disputeId} — Disputed</div>
          <div className="v-page-subtitle">
            Helios Research Agent v. DataSpring MCP · Failure to deliver dataset
          </div>
        </div>
        <span className="v-badge v-badge-gold">
          <span className="v-badge-dot" />
          Awaiting your vote
        </span>
      </div>

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
                Voting closes in
              </div>
              <div
                className="v-mono"
                style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.5px" }}
              >
                {timer}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                Panel progress
              </div>
              <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                {votedCount} / 3 voted
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
                    width: `${(votedCount / 3) * 100}%`,
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
                  Case № {disputeId} · Opened 5 minutes ago
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.3px" }}>
                  Helios Research Agent v. DataSpring MCP
                </div>
              </div>
              <div
                className="v-mono"
                style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.5px" }}
              >
                $2,500.00
                <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 400 }}>
                  {" "}
                  USDC
                </span>
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <Field label="Petitioner" value="5xKpT…4wRq" mono />
                <Field label="Respondent" value="Bq4T…9wLk" mono />
                <Field
                  label="Claim"
                  value="Failure to deliver promised dataset under x402 payment. Null response across 3 retries."
                />
                <Field label="Vault" value="Mn7R…3kPx · confirmed" mono dim />
              </div>
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
                  ipfs://QmX7vK9wR3mN2pL8qT4sF6hJ1bD5cA0eW/dispute-evidence.json
                </div>
              </div>
            </div>
          </div>

          {/* Vote buttons — adjacent, no card header */}
          {!resolved ? (
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
                desc="Return $2,500 USDC to payer"
                tone="refund"
                onClick={() => requestVote("refund")}
                disabled={voted !== null || resolving}
                dim={voted !== null && voted !== "refund"}
              />
              <VoteButton
                label="↗ Release to merchant"
                desc="Deliver $2,500 USDC to respondent"
                tone="release"
                onClick={() => requestVote("release")}
                disabled={voted !== null || resolving}
                dim={voted !== null && voted !== "release"}
              />
            </div>
          ) : null}

          {voted !== null && !resolved ? (
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
                You voted —{" "}
                <strong style={{ color: voted === "refund" ? "var(--gold)" : "var(--blue)" }}>
                  {voted === "refund" ? "Refund petitioner" : "Release to merchant"}
                </strong>
              </div>
              <button
                className="v-btn v-btn-primary"
                disabled={resolving}
                onClick={requestResolve}
              >
                {resolving ? "Sealing…" : "Render verdict"}
              </button>
            </div>
          ) : null}

          {resolved ? (
            <div
              className="v-card v-card-lg"
              style={{
                background: "var(--gold-bg)",
                border: "1px solid var(--gold-border)",
                padding: 28,
                textAlign: "center",
                marginBottom: 16,
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
                {verdictText}
              </div>
              <div className="v-mono" style={{ fontSize: 13, color: "var(--text-2)" }}>
                {verdictSub}
              </div>
            </div>
          ) : null}

          {/* Jurors */}
          <div className="v-card v-card-lg" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>Juror panel</div>
              <span className="v-badge v-badge-gray">3 seated · {votedCount}/3 voted</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              {jurors.map((j, i) => (
                <div
                  key={j.name}
                  style={{
                    padding: 16,
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: j.you ? "var(--text-1)" : "var(--bg-muted)",
                      color: j.you ? "#fff" : "var(--text-2)",
                      border: j.you ? "none" : "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: j.you ? 11 : 12,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {j.letter}
                  </div>
                  <div
                    className="v-mono"
                    style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}
                  >
                    {j.name}
                  </div>
                  <div
                    className="v-mono"
                    style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}
                  >
                    {j.rep} · {j.tier}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      color:
                        j.vote === "refund"
                          ? "var(--gold)"
                          : j.vote === "release"
                            ? "var(--blue)"
                            : "var(--text-3)",
                    }}
                  >
                    {j.vote === "refund"
                      ? "Voted refund"
                      : j.vote === "release"
                        ? "Voted release"
                        : "Awaiting vote"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="v-layout-side" style={{ borderTop: "none" }}>
          <div style={{ marginBottom: 24 }}>
            <div className="v-side-label">Case timeline</div>
            <Timeline
              items={
                [
                  voted
                    ? {
                        time: "now",
                        text: (
                          <>
                            You voted <strong>{voted}</strong>
                          </>
                        ),
                        sig: "sig 4xKpT…9wRq",
                      }
                    : null,
                  {
                    time: voted ? "1s" : "now",
                    text: (
                      <>
                        <strong>Bq4T</strong> voted refund
                      </>
                    ),
                    sig: "sig 8vRjN2…pXq1",
                  },
                  { time: "3m", text: <>Panel of 3 jurors seated</>, sig: "sig Hp4mLk…2nRq" },
                  { time: "5m", text: <>Evidence pinned to IPFS</>, sig: "sig vKp9wR…3mNp" },
                  {
                    time: "5m",
                    text: (
                      <>
                        Dispute {disputeId} opened by <strong>5xKpT</strong>
                      </>
                    ),
                    sig: "sig 3xKpT9…mNq7",
                  },
                  {
                    time: "18m",
                    text: <>Escrow funded · $2,500 USDC</>,
                    sig: "sig Wm3Lk7…4xQp",
                  },
                ].filter(Boolean) as TimelineItem[]
              }
            />
          </div>
          <div className="v-sep" />
          <div>
            <div className="v-side-label">Escrow details</div>
            <SideRow label="Amount" value="$2,500" />
            <SideRow label="Juror stake" value="50 USDC" />
            <SideRow label="Panel" value="3 jurors" />
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
            <strong>+1 reputation</strong>.{" "}
            {pendingChoice === "refund" ? (
              <>
                A <strong>refund</strong> verdict returns $2,500 USDC to the petitioner.
              </>
            ) : (
              <>
                A <strong>release</strong> verdict delivers $2,500 USDC to the respondent.
              </>
            )}
          </>
        }
        confirmLabel={`Confirm ${pendingChoice ?? ""}`}
        onConfirm={confirmVote}
        onCancel={() => setPendingChoice(null)}
      />

      <ConfirmModal
        open={confirmingResolve}
        title="Render the verdict"
        body={
          <>
            This tallies the panel&rsquo;s votes and atomically settles the
            escrow on-chain. Once rendered, the verdict is final — there is no
            appeal. Both parties have agreed to the panel&rsquo;s decision at
            escrow creation.
          </>
        }
        confirmLabel="Render verdict"
        onConfirm={confirmResolve}
        onCancel={() => setConfirmingResolve(false)}
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
  dim,
}: {
  label: string;
  desc: string;
  tone: "refund" | "release";
  onClick: () => void;
  disabled: boolean;
  dim?: boolean;
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
        opacity: dim ? 0.4 : 1,
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

interface TimelineItem {
  time: string;
  text: React.ReactNode;
  sig: string;
}
function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <>
      {items.map((it, i) => (
        <div className="v-feed-item" key={i}>
          <div className="v-feed-time">{it.time}</div>
          <div>
            <div style={{ color: "var(--text-2)", lineHeight: 1.5 }}>{it.text}</div>
            <div className="v-mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {it.sig}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function Field({
  label,
  value,
  mono,
  dim,
}: {
  label: string;
  value: string;
  mono?: boolean;
  dim?: boolean;
}) {
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
        {value}
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
