"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [resolving, setResolving] = useState(false);
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

  const onVote = (c: VoteChoice) => {
    if (voted || resolving || resolved) return;
    setVoted(c);
    setJurors((prev) => prev.map((j) => (j.you ? { ...j, vote: c } : j)));
  };

  const onResolve = () => {
    if (!voted || resolving || resolved) return;
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
      <div className="page-header">
        <div>
          <Link href="/disputes" className="page-back">
            ← Disputes
          </Link>
          <div className="page-title">{disputeId} — Disputed</div>
          <div className="page-subtitle">
            Helios Research Agent v. DataSpring MCP · Failure to deliver dataset
          </div>
        </div>
        <span className="badge badge-gold">
          <span className="badge-dot" />
          Awaiting your vote
        </span>
      </div>

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
              <div className="timer-label">Voting closes in</div>
              <div className="timer-val">{timer}</div>
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
                {votedCount} / 3 voted
              </div>
              <div className="timer-progress">
                <div
                  className="timer-progress-fill"
                  style={{ width: `${(votedCount / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Case file */}
          <div className="case-card">
            <div className="case-card-header">
              <div>
                <div className="case-id">Case № {disputeId} · Opened 5 minutes ago</div>
                <div className="case-title">Helios Research Agent v. DataSpring MCP</div>
              </div>
              <div className="case-amount">
                $2,500.00<span className="case-amount-sub"> USDC</span>
              </div>
            </div>
            <div className="case-body">
              <div className="case-grid">
                <Field label="Petitioner" value="5xKpT…4wRq" mono />
                <Field label="Respondent" value="Bq4T…9wLk" mono />
                <Field
                  label="Claim"
                  value="Failure to deliver promised dataset under x402 payment. Null response across 3 retries."
                />
                <Field label="Vault" value="Mn7R…3kPx · confirmed" mono dim />
              </div>
              <div className="evidence-box">
                <div className="evidence-label">Evidence URI</div>
                <div className="evidence-uri">
                  ipfs://QmX7vK9wR3mN2pL8qT4sF6hJ1bD5cA0eW/dispute-evidence.json
                </div>
              </div>
            </div>
          </div>

          {/* Vote */}
          <div className="vote-card">
            <div className="vote-card-header">
              <div className="vote-card-title">Cast your vote</div>
              <div className="vote-card-sub">
                Review the evidence above before voting. Your decision is final once submitted.
              </div>
            </div>

            {voted === null ? (
              <div className="vote-actions">
                <button
                  className="vote-btn refund"
                  onClick={() => onVote("refund")}
                  disabled={resolving || resolved}
                >
                  <div className="vote-btn-label">↩ Refund petitioner</div>
                  <div className="vote-btn-desc">Return $2,500 USDC to payer</div>
                </button>
                <button
                  className="vote-btn release"
                  onClick={() => onVote("release")}
                  disabled={resolving || resolved}
                >
                  <div className="vote-btn-label">↗ Release to merchant</div>
                  <div className="vote-btn-desc">Deliver $2,500 USDC to respondent</div>
                </button>
              </div>
            ) : null}

            {voted !== null && !resolved ? (
              <div className="vote-resolve">
                <div className="voted-state">
                  You voted —{" "}
                  <strong style={{ color: voted === "refund" ? "var(--gold)" : "var(--blue)" }}>
                    {voted === "refund" ? "Refund petitioner" : "Release to merchant"}
                  </strong>
                </div>
                <button className="btn btn-primary" disabled={resolving} onClick={onResolve}>
                  {resolving ? "Sealing…" : "Render verdict"}
                </button>
              </div>
            ) : null}

            {resolved ? (
              <div className="verdict-announcement">
                <div className="verdict-eyebrow">⚖ Verdict rendered</div>
                <div className="verdict-text">{verdictText}</div>
                <div className="verdict-sub">{verdictSub}</div>
              </div>
            ) : null}
          </div>

          {/* Jurors */}
          <div className="juror-card">
            <div className="juror-card-header">
              <div className="section-title">Juror panel</div>
              <span className="badge badge-gray">3 seated · {votedCount}/3 voted</span>
            </div>
            <div className="juror-grid">
              {jurors.map((j) => (
                <div className="juror-tile" key={j.name}>
                  <div className={`juror-avatar${j.you ? " you" : ""}`}>{j.letter}</div>
                  <div className="juror-name">{j.name}</div>
                  <div className="juror-rep">
                    {j.rep} · {j.tier}
                  </div>
                  <div
                    className={
                      "juror-status " +
                      (j.vote === "refund"
                        ? "refund"
                        : j.vote === "release"
                          ? "release"
                          : "awaiting")
                    }
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

        {/* Side rail */}
        <aside className="layout-side" style={{ borderTop: "none" }}>
          <div className="side-section">
            <div className="side-label">Case timeline</div>
            <Timeline
              items={[
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
              ].filter(Boolean) as TimelineItem[]}
            />
          </div>

          <div className="sep" />

          <div className="side-section">
            <div className="side-label">Escrow details</div>
            <SideMetric label="Amount" value="$2,500" />
            <SideMetric label="Juror stake" value="50 USDC" />
            <SideMetric label="Panel" value="3 jurors" />
            <SideMetric label="Tie-break" value="Release" />
          </div>
        </aside>
      </div>
    </>
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
        <div className="feed-item" key={i}>
          <div className="feed-time">{it.time}</div>
          <div>
            <div className="feed-text">{it.text}</div>
            <div className="feed-sig">{it.sig}</div>
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
      <div className="case-field-label">{label}</div>
      <div
        className={`case-field-val${mono ? " mono" : ""}`}
        style={dim ? { color: "var(--text-3)" } : undefined}
      >
        {value}
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
