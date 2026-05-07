"use client";

interface CaseRow {
  id: string;
  matter: string;
  yourVote: "Refund" | "Release";
  outcome: "Refund" | "Release";
  reward: string | null;
}

const CASES: CaseRow[] = [
  { id: "ESC-0039", matter: "Atlas v. RoomGraph", yourVote: "Refund", outcome: "Refund", reward: "+$14.00" },
  { id: "ESC-0037", matter: "PayDirect v. Acme", yourVote: "Release", outcome: "Release", reward: "+$8.50" },
  { id: "ESC-0034", matter: "Compose v. RenderForge", yourVote: "Refund", outcome: "Release", reward: null },
];

const VOTE_BADGE: Record<"Refund" | "Release", string> = {
  Refund: "badge badge-gold",
  Release: "badge badge-blue",
};

export default function JurorProfileView() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Juror Profile</div>
          <div className="page-subtitle">4xKpT…9wLk · Tier II · 847 reputation</div>
        </div>
        <button className="btn btn-primary btn-sm">Claim rewards</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          background: "var(--bg-2)",
          minHeight: "calc(100vh - 52px - 105px)",
        }}
      >
        <div style={{ padding: "20px 24px" }}>
          {/* Stat cards */}
          <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div className="stat-card">
              <div className="stat-label">Reputation</div>
              <div className="stat-value">847</div>
              <div className="stat-delta delta-up">↑ 12 this week</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cases voted</div>
              <div className="stat-value">34</div>
              <div className="stat-delta" style={{ color: "var(--text-3)" }}>
                94% majority aligned
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending rewards</div>
              <div className="stat-value">$42.00</div>
              <div className="stat-delta delta-up">3 cases</div>
            </div>
          </div>

          {/* Tier progress */}
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="section-title">Tier progress</div>
                <div className="section-sub">847 / 1,000 to Tier III</div>
              </div>
              <span className="badge badge-gold">Tier II</span>
            </div>
            <div style={{ padding: 20 }}>
              <div className="tier-row">
                <span>Tier I · 0</span>
                <span>Tier II · 500</span>
                <span>Tier III · 1,000</span>
                <span>Tier IV · 2,500</span>
              </div>
              <div className="tier-track">
                <div className="tier-fill" style={{ width: "57%" }} />
              </div>
            </div>
          </div>

          {/* Recent cases */}
          <div className="table-wrap">
            <div
              className="table-head"
              style={{ gridTemplateColumns: "100px 1fr 90px 90px 90px" }}
            >
              <div className="th">Case</div>
              <div className="th">Matter</div>
              <div className="th">Your vote</div>
              <div className="th">Outcome</div>
              <div className="th">Reward</div>
            </div>
            {CASES.map((c) => (
              <div
                className="table-row"
                style={{ gridTemplateColumns: "100px 1fr 90px 90px 90px" }}
                key={c.id}
              >
                <div className="cell-id">{c.id}</div>
                <div className="cell-matter">{c.matter}</div>
                <div>
                  <span className={VOTE_BADGE[c.yourVote]} style={{ fontSize: 11 }}>
                    {c.yourVote}
                  </span>
                </div>
                <div>
                  <span className={VOTE_BADGE[c.outcome]} style={{ fontSize: 11 }}>
                    {c.outcome}
                  </span>
                </div>
                <div
                  className="cell-amount"
                  style={{
                    fontSize: 13,
                    color: c.reward ? "var(--green)" : "var(--text-3)",
                  }}
                >
                  {c.reward ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="layout-side">
          <div className="side-section">
            <div className="side-label">Juror details</div>
            <SideMetric label="Wallet" value="4xKpT…9wLk" mono />
            <SideMetric label="Registered" value="Apr 6, 2026" />
            <SideMetric label="Active panels" value="1" />
            <SideMetric label="Majority rate" value="94%" valueColor="var(--green)" />
          </div>
          <div className="sep" />
          <div className="side-section">
            <div className="side-label">Claimable rewards</div>
            <SideMetric label="ESC-0039" value="$14.00" valueColor="var(--green)" />
            <SideMetric label="ESC-0037" value="$8.50" valueColor="var(--green)" />
            <SideMetric label="ESC-0033" value="$19.50" valueColor="var(--green)" />
            <div className="sep" />
            <div className="side-metric">
              <span
                className="side-metric-label"
                style={{ fontWeight: 600, color: "var(--text-1)" }}
              >
                Total
              </span>
              <span
                className="side-metric-val"
                style={{ color: "var(--green)", fontSize: 15 }}
              >
                $42.00
              </span>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
            >
              Claim all rewards
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function SideMetric({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="side-metric">
      <span className="side-metric-label">{label}</span>
      <span
        className="side-metric-val"
        style={{
          ...(mono ? { fontSize: 12 } : {}),
          ...(valueColor ? { color: valueColor } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}
