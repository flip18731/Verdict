"use client";

import Link from "next/link";

export default function LandingView() {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "80px 24px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <span className="badge badge-gold" style={{ marginBottom: 20 }}>
          <span className="badge-dot" />
          Hackathon MVP · Solana
        </span>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: "-0.5px",
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          Dispute resolution for agentic commerce
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-2)",
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          Verdict is the missing settlement layer for autonomous-agent payments
          on Solana. Funds live in a program-controlled escrow, evidence is
          anchored on-chain, and a three-juror panel rules in seconds — without
          chargebacks, support tickets, or human intermediaries.
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginBottom: 56,
          }}
        >
          <Link href="/disputes" className="btn btn-primary">
            View active cases
          </Link>
          <Link href="/escrows/new" className="btn btn-ghost">
            Open an escrow
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Total verdicts</div>
          <div className="stat-value">1,248</div>
          <div className="stat-delta delta-up">↑ 34 this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TVL · escrows</div>
          <div className="stat-value">$4.2M</div>
          <div className="stat-delta" style={{ color: "var(--text-3)" }}>
            across 412 active jurors
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Median resolution</div>
          <div className="stat-value">3.4h</div>
          <div className="stat-delta delta-up">↓ 12m this week</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 64,
          maxWidth: 720,
          margin: "64px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
      >
        <Pillar
          n="1"
          title="Fund"
          body="Payer locks USDC into a program-owned vault. Neither party can withdraw alone."
        />
        <Pillar
          n="2"
          title="Deliver"
          body="Merchant performs the service. Payer releases — or files a dispute with evidence."
        />
        <Pillar
          n="3"
          title="Vote"
          body="A panel of three on-chain jurors reviews evidence and votes within a fixed window."
        />
        <Pillar
          n="4"
          title="Settle"
          body="The majority verdict triggers automatic on-chain transfer. Atomically. No retries."
        />
      </div>
    </div>
  );
}

function Pillar({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11.5,
          color: "var(--text-3)",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        STEP {n}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
}
