"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useOpenDisputes } from "@/lib/queries";

interface DemoDispute {
  id: string;
  matter: string;
  matterSub: string;
  amount: string;
  status: "Disputed" | "Released" | "Funded" | "Refunded";
  closes: string;
  active: boolean;
}

const DEMO_DISPUTES: DemoDispute[] = [
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

const STATUS_BADGE: Record<DemoDispute["status"], string> = {
  Disputed: "badge badge-gold",
  Released: "badge badge-green",
  Funded: "badge badge-blue",
  Refunded: "badge badge-gold",
};

export default function DisputesListView() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const live = useOpenDisputes();

  const connected = !!wallet.publicKey;
  const liveRows = live.data ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Active Disputes</div>
          <div className="page-subtitle">
            {connected
              ? "Disputes assigned to your juror panel"
              : "Connect a wallet to see disputes assigned to you"}
          </div>
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
          <Stat label="Open disputes" value={connected ? String(liveRows.length) : "12"} delta={connected ? null : "↑ 3 today"} />
          <Stat label="TVL in escrow" value="$4.2M" delta="↓ 2.1%" deltaDown />
          <Stat label="Median resolution" value="3.4h" delta="↓ 12m faster" />
          <Stat label="Your reputation" value="847" delta="Tier II" muted />
        </div>
      </div>
      <div className="divider-line" style={{ marginTop: 20 }} />

      <div className="layout">
        <div className="layout-main">
          {!connected ? (
            <DemoBanner onConnect={() => setVisible(true)} />
          ) : null}

          <div className="table-wrap">
            <div className="table-head">
              <div className="th">Case</div>
              <div className="th">Matter</div>
              <div className="th">Amount</div>
              <div className="th">Status</div>
              <div className="th">Closes</div>
              <div className="th"></div>
            </div>

            {connected && live.isLoading ? (
              <div className="empty">Loading disputes from chain…</div>
            ) : connected && liveRows.length === 0 ? (
              <div className="empty">
                <p style={{ marginBottom: 8 }}>
                  No open disputes match your wallet right now.
                </p>
                <p style={{ fontSize: 12.5 }}>
                  When a payer raises a dispute on an escrow you&rsquo;re seated
                  on, it will appear here.
                </p>
              </div>
            ) : connected ? (
              liveRows.map((d) => {
                const id = d.publicKey.toBase58();
                return (
                  <Link key={id} href={`/disputes/${id}`} className="table-row">
                    <div className="cell-id">{id.slice(0, 8)}…</div>
                    <div>
                      <div className="cell-matter">{d.account.evidenceUri || "(no evidence URI)"}</div>
                      <div className="cell-matter-sub">
                        votes: refund {d.account.votesForRefund} · release{" "}
                        {d.account.votesForRelease}
                      </div>
                    </div>
                    <div className="cell-amount">—</div>
                    <div>
                      <span className="badge badge-gold">
                        <span className="badge-dot" />
                        Disputed
                      </span>
                    </div>
                    <div className="cell-time">
                      {d.account.jurorsVoted}/{d.account.jurorsSeated}
                    </div>
                    <div>
                      <span className="btn btn-primary btn-sm">Open →</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              DEMO_DISPUTES.map((d) => (
                <Link key={d.id} href={`/disputes/${d.id}`} className="table-row">
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
                        d.active ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"
                      }
                    >
                      {d.active ? "Vote →" : "View"}
                    </span>
                  </div>
                </Link>
              ))
            )}
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

function Stat({
  label,
  value,
  delta,
  deltaDown,
  muted,
}: {
  label: string;
  value: string;
  delta: string | null;
  deltaDown?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta ? (
        <div
          className={
            muted ? "stat-delta" : deltaDown ? "stat-delta delta-down" : "stat-delta delta-up"
          }
          style={muted ? { color: "var(--text-3)" } : undefined}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

function DemoBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>
        Showing example data.{" "}
        <strong style={{ color: "var(--text-1)" }}>Connect a wallet</strong> to
        see your real disputes from the chain.
      </div>
      <button className="btn btn-primary btn-sm" onClick={onConnect}>
        Connect wallet
      </button>
    </div>
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
