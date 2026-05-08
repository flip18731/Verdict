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
  Disputed: "v-badge v-badge-gold",
  Released: "v-badge v-badge-green",
  Funded: "v-badge v-badge-blue",
  Refunded: "v-badge v-badge-gold",
};

const TABLE_COLS = "100px 1fr 110px 110px 110px 80px";

export default function DisputesListView() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const live = useOpenDisputes();

  const connected = !!wallet.publicKey;
  const liveRows = live.data ?? [];

  return (
    <>
      <div className="v-page-header">
        <div>
          <div className="v-page-title">Active Disputes</div>
          <div className="v-page-subtitle">
            {connected
              ? "Disputes assigned to your juror panel"
              : "Connect a wallet to see disputes assigned to you"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="v-btn v-btn-ghost v-btn-sm">Filter</button>
          <Link href="/jurors/me" className="v-btn v-btn-primary v-btn-sm">
            Register as Juror
          </Link>
        </div>
      </div>

      <div style={{ padding: "20px 24px 0", background: "var(--bg)" }}>
        <div className="v-stats">
          <Stat
            label="Open disputes"
            value={connected ? String(liveRows.length) : "12"}
            delta={connected ? null : "↑ 3 today"}
          />
          <Stat label="TVL in escrow" value="$4.2M" delta="↓ 2.1%" deltaDown />
          <Stat label="Median resolution" value="3.4h" delta="↓ 12m faster" />
          <Stat label="Your reputation" value="847" delta="Tier II" muted />
        </div>
      </div>
      <div style={{ height: 1, background: "var(--border)" }} />

      <div className="v-layout">
        <div className="v-layout-main">
          {!connected ? <DemoBanner onConnect={() => setVisible(true)} /> : null}

          <div className="v-table">
            <div className="v-thead" style={{ gridTemplateColumns: TABLE_COLS }}>
              <div className="v-th">Case</div>
              <div className="v-th">Matter</div>
              <div className="v-th">Amount</div>
              <div className="v-th">Status</div>
              <div className="v-th">Closes</div>
              <div className="v-th"></div>
            </div>

            {connected && live.isLoading ? (
              <div className="v-empty">Loading disputes from chain…</div>
            ) : connected && liveRows.length === 0 ? (
              <div className="v-empty">
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
                  <Link
                    key={id}
                    href={`/disputes/${id}`}
                    className="v-tr"
                    style={{ gridTemplateColumns: TABLE_COLS }}
                  >
                    <div className="v-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                      {id.slice(0, 8)}…
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5 }}>
                        {d.account.evidenceUri || "(no evidence URI)"}
                      </div>
                      <div className="v-mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        votes: refund {d.account.votesForRefund} · release{" "}
                        {d.account.votesForRelease}
                      </div>
                    </div>
                    <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                      —
                    </div>
                    <div>
                      <span className="v-badge v-badge-gold">
                        <span className="v-badge-dot" />
                        Disputed
                      </span>
                    </div>
                    <div className="v-mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                      {d.account.jurorsVoted}/{d.account.jurorsSeated}
                    </div>
                    <div>
                      <span className="v-btn v-btn-primary v-btn-sm">Open →</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              DEMO_DISPUTES.map((d) => (
                <Link
                  key={d.id}
                  href={`/disputes/${d.id}`}
                  className="v-tr"
                  style={{ gridTemplateColumns: TABLE_COLS }}
                >
                  <div className="v-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {d.id}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5 }}>{d.matter}</div>
                    <div className="v-mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {d.matterSub}
                    </div>
                  </div>
                  <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                    {d.amount}
                  </div>
                  <div>
                    <span className={STATUS_BADGE[d.status]}>
                      <span className="v-badge-dot" />
                      {d.status}
                    </span>
                  </div>
                  <div className="v-mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    {d.closes}
                  </div>
                  <div>
                    <span
                      className={
                        d.active ? "v-btn v-btn-primary v-btn-sm" : "v-btn v-btn-ghost v-btn-sm"
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

        <aside className="v-layout-side">
          <div style={{ marginBottom: 24 }}>
            <div className="v-side-label">Live feed</div>
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

          <div className="v-sep" />

          <div>
            <div className="v-side-label">Court metrics · 24h</div>
            <SideRow label="Total verdicts" value="1,248" />
            <SideRow label="Active jurors" value="412" />
            <SideRow label="Refund rate" value="61%" />
            <SideRow label="Avg panel size" value="3.0" />
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
    <div className="v-card v-stat">
      <div className="v-stat-label">{label}</div>
      <div className="v-stat-value">{value}</div>
      {delta ? (
        <div
          className={
            muted ? "v-stat-delta" : deltaDown ? "v-stat-delta delta-dn" : "v-stat-delta delta-up"
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
      className="v-card"
      style={{
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>
        Showing example data.{" "}
        <strong style={{ color: "var(--text-1)" }}>Connect a wallet</strong> to see
        your real disputes from the chain.
      </div>
      <button className="v-btn v-btn-primary v-btn-sm" onClick={onConnect}>
        Connect wallet
      </button>
    </div>
  );
}

function FeedItem({
  time,
  text,
  sig,
}: {
  time: string;
  text: React.ReactNode;
  sig: string;
}) {
  return (
    <div className="v-feed-item">
      <div className="v-feed-time">{time}</div>
      <div>
        <div style={{ color: "var(--text-2)", lineHeight: 1.5 }}>{text}</div>
        <div className="v-mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {sig}
        </div>
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
