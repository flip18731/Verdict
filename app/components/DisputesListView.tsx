"use client";

import Link from "next/link";

interface Dispute {
  id: string;
  matter: string;
  matterSub: string;
  amount: string;
  status: "Disputed" | "Released" | "Funded" | "Refunded";
  closes: string;
  active: boolean;
}

const DISPUTES: Dispute[] = [
  {
    id: "ESC-0042",
    matter: "Helios Agent v. DataSpring MCP",
    matterSub: "Failure to deliver dataset",
    amount: "$2,500",
    status: "Disputed",
    closes: "3h 42m",
    active: true,
  },
  {
    id: "ESC-0041",
    matter: "Compose Studio v. RenderForge GPU",
    matterSub: "Hardware benchmark mismatch",
    amount: "$38.50",
    status: "Disputed",
    closes: "5h 11m",
    active: false,
  },
  {
    id: "ESC-0040",
    matter: "Atlas Booking v. RoomGraph",
    matterSub: "Double-charge on API call",
    amount: "$142.00",
    status: "Released",
    closes: "Closed",
    active: false,
  },
  {
    id: "ESC-0038",
    matter: "PayDirect v. Acme MCP Search",
    matterSub: "Prompt injection suspected",
    amount: "$12.10",
    status: "Funded",
    closes: "11h 4m",
    active: false,
  },
];

const STATUS_BADGE: Record<Dispute["status"], string> = {
  Disputed: "badge badge-gold",
  Released: "badge badge-green",
  Funded: "badge badge-blue",
  Refunded: "badge badge-gold",
};

export default function DisputesListView() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Active Disputes</div>
          <div className="page-subtitle">Disputes assigned to your juror panel</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm">Filter</button>
          <Link href="/jurors/me" className="btn btn-primary btn-sm">
            Register as Juror
          </Link>
        </div>
      </div>

      <div style={{ padding: "20px 24px 0", background: "var(--bg)" }}>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Open disputes</div>
            <div className="stat-value">12</div>
            <div className="stat-delta delta-up">↑ 3 today</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TVL in escrow</div>
            <div className="stat-value">$4.2M</div>
            <div className="stat-delta delta-down">↓ 2.1%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Median resolution</div>
            <div className="stat-value">3.4h</div>
            <div className="stat-delta delta-up">↓ 12m faster</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Your reputation</div>
            <div className="stat-value">847</div>
            <div className="stat-delta" style={{ color: "var(--text-3)" }}>
              Tier II
            </div>
          </div>
        </div>
      </div>
      <div className="divider-line" style={{ marginTop: 20 }} />

      <div className="layout">
        <div className="layout-main">
          <div className="table-wrap">
            <div className="table-head">
              <div className="th">Case</div>
              <div className="th">Matter</div>
              <div className="th">Amount</div>
              <div className="th">Status</div>
              <div className="th">Closes</div>
              <div className="th"></div>
            </div>
            {DISPUTES.map((d) => (
              <Link
                key={d.id}
                href={`/disputes/${d.id}`}
                className="table-row"
              >
                <div className="cell-id">{d.id}</div>
                <div>
                  <div className="cell-matter">{d.matter}</div>
                  <div className="cell-matter-sub">{d.matterSub}</div>
                </div>
                <div className="cell-amount">{d.amount}</div>
                <div>
                  <span className={STATUS_BADGE[d.status]}>
                    <span className="badge-dot" />
                    {d.status}
                  </span>
                </div>
                <div className="cell-time">{d.closes}</div>
                <div>
                  <span
                    className={
                      d.active
                        ? "btn btn-primary btn-sm"
                        : "btn btn-ghost btn-sm"
                    }
                  >
                    {d.active ? "Vote →" : "View"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="layout-side">
          <div className="side-section">
            <div className="side-label">Live feed</div>
            <FeedItem
              time="now"
              text={
                <>
                  <strong>Juror Bq4T…9wLk</strong> seated to panel
                </>
              }
              sig="sig 8vRjN2…pXq1"
            />
            <FeedItem
              time="2m"
              text={
                <>
                  Dispute <strong>ESC-0042</strong> opened
                </>
              }
              sig="sig Hp4mLk…2nRq"
            />
            <FeedItem
              time="11m"
              text={
                <>
                  Verdict for <strong>ESC-0040</strong> — Release
                </>
              }
              sig="sig Wm3Lk7…4xQp"
            />
            <FeedItem
              time="24m"
              text={
                <>
                  New escrow <strong>ESC-0038</strong> funded
                </>
              }
              sig="sig vKp9wR…3mNp"
            />
          </div>

          <div className="sep" />

          <div className="side-section">
            <div className="side-label">Court metrics · 24h</div>
            <SideMetric label="Total verdicts" value="1,248" />
            <SideMetric label="Active jurors" value="412" />
            <SideMetric label="Refund rate" value="61%" />
            <SideMetric label="Avg panel size" value="3.0" />
          </div>
        </aside>
      </div>
    </>
  );
}

function FeedItem({ time, text, sig }: { time: string; text: React.ReactNode; sig: string }) {
  return (
    <div className="feed-item">
      <div className="feed-time">{time}</div>
      <div>
        <div className="feed-text">{text}</div>
        <div className="feed-sig">{sig}</div>
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
