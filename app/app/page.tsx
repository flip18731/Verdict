import Link from "next/link";

const STATS = [
  { label: "Total verdicts", value: "1,248" },
  { label: "TVL in escrow", value: "$4.2M" },
  { label: "Median resolution", value: "3.4h" },
];

const HOW_STEPS = [
  {
    n: "1",
    title: "Lock funds",
    desc: "Payer creates an escrow and deposits USDC into a program-controlled vault.",
  },
  {
    n: "2",
    title: "Raise dispute",
    desc: "If service fails, payer raises a dispute and attaches evidence on-chain.",
  },
  {
    n: "3",
    title: "Panel rules",
    desc: "Three bonded jurors vote within the window. Vault settles to the majority verdict.",
  },
];

export default function Home() {
  return (
    <div style={{ maxWidth: 680, margin: "80px auto", padding: "0 24px" }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: "var(--text-3)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
        }}
      >
        Built on Solana · Devnet
      </div>
      <h1
        style={{
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: "-.5px",
          lineHeight: 1.15,
          marginBottom: 16,
        }}
      >
        Dispute resolution for{" "}
        <span className="hero-highlight">agentic commerce</span>.
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "var(--text-2)",
          lineHeight: 1.7,
          marginBottom: 32,
        }}
      >
        When an AI agent pays for a service and something goes wrong, Verdict&rsquo;s
        bonded juror network resolves it onchain in hours — not weeks. The missing
        third leg of the agent commerce stack.
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Link href="/escrows/new" className="v-btn v-btn-primary">
          Open an escrow →
        </Link>
        <Link href="/disputes" className="v-btn v-btn-ghost">
          View disputes
        </Link>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-3)",
          letterSpacing: ".04em",
          marginBottom: 48,
        }}
      >
        ✓ Deployed on Solana Devnet · ✓ 15 tests passing · ✓ Open source
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
          marginBottom: 40,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="v-card v-card-hover" style={{ padding: 16 }}>
            <div className="v-stat-label">
              {s.label}
              <span className="demo-tag">(demo)</span>
            </div>
            <div className="v-stat-value" style={{ fontSize: 20 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-3)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          How it works
        </div>
        <div
          className="v-card"
          style={{ display: "flex", padding: 0, overflow: "hidden" }}
        >
          {HOW_STEPS.map((step, i) => (
            <div
              key={step.n}
              className="how-step"
              style={{
                borderRight: i < HOW_STEPS.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="how-step-num">{step.n}</div>
              <div className="how-step-title">{step.title}</div>
              <div className="how-step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust bar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          color: "var(--text-3)",
          fontSize: 12.5,
          fontFamily: "var(--font-mono)",
          borderTop: "1px solid var(--border)",
          paddingTop: 24,
        }}
      >
        <span>⚡ Solana · sub-second finality</span>
        <span>🔒 Program-owned vault</span>
        <span>⚖ Bonded jurors</span>
        <span>✓ Open source</span>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
