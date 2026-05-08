import Link from "next/link";

const STATS = [
  { label: "Total verdicts", value: "1,248" },
  { label: "TVL in escrow", value: "$4.2M" },
  { label: "Median resolution", value: "3.4h" },
];

export default function Home() {
  return (
    <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
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
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "-.5px",
          lineHeight: 1.15,
          marginBottom: 16,
        }}
      >
        Dispute resolution for agentic commerce.
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
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/escrows/new" className="v-btn v-btn-primary">
          Open an escrow →
        </Link>
        <Link href="/disputes" className="v-btn v-btn-ghost">
          View disputes
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
          marginTop: 48,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="v-card" style={{ padding: 16 }}>
            <div className="v-stat-label">{s.label}</div>
            <div className="v-stat-value" style={{ fontSize: 20 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
