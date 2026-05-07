"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEscrowsForWallet } from "@/lib/queries";

interface DemoEscrow {
  id: string;
  matter: string;
  matterSub: string;
  amount: string;
  status: "Funded" | "Released" | "Disputed" | "Refunded";
  closes: string;
  role: "Payer" | "Merchant";
}

const DEMO: DemoEscrow[] = [
  {
    id: "ESC-0042",
    matter: "Helios Agent v. DataSpring MCP",
    matterSub: "Failure to deliver dataset",
    amount: "$2,500",
    status: "Disputed",
    closes: "3h 42m",
    role: "Payer",
  },
  {
    id: "ESC-0038",
    matter: "PayDirect v. Acme MCP Search",
    matterSub: "Prompt injection suspected",
    amount: "$12.10",
    status: "Funded",
    closes: "11h 4m",
    role: "Payer",
  },
  {
    id: "ESC-0036",
    matter: "Compose Studio render farm",
    matterSub: "GPU bench job",
    amount: "$84.00",
    status: "Released",
    closes: "Closed",
    role: "Merchant",
  },
  {
    id: "ESC-0033",
    matter: "Atlas booking API",
    matterSub: "Hotel block hold",
    amount: "$910.00",
    status: "Refunded",
    closes: "Closed",
    role: "Payer",
  },
];

const STATUS_BADGE: Record<DemoEscrow["status"], string> = {
  Funded: "badge badge-blue",
  Released: "badge badge-green",
  Disputed: "badge badge-gold",
  Refunded: "badge badge-gold",
};

function statusOf(account: { status: object }): keyof typeof STATUS_BADGE {
  if ("disputed" in account.status) return "Disputed";
  if ("released" in account.status) return "Released";
  if ("refunded" in account.status) return "Refunded";
  return "Funded";
}

export default function EscrowsListView() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const live = useEscrowsForWallet(wallet.publicKey ?? null);

  const connected = !!wallet.publicKey;
  const liveRows = live.data ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">My Escrows</div>
          <div className="page-subtitle">
            {connected
              ? "Every escrow where you are payer or merchant"
              : "Connect a wallet to see your escrows"}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm">Filter</button>
          <Link href="/escrows/new" className="btn btn-primary btn-sm">
            New escrow
          </Link>
        </div>
      </div>

      <div className="layout">
        <div className="layout-main">
          {!connected ? (
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
                Showing example escrows. Connect a wallet to see your real
                positions.
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setVisible(true)}
              >
                Connect wallet
              </button>
            </div>
          ) : null}

          <div className="table-wrap">
            <div className="table-head">
              <div className="th">Case</div>
              <div className="th">Matter</div>
              <div className="th">Amount</div>
              <div className="th">Status</div>
              <div className="th">Closes</div>
              <div className="th">Role</div>
            </div>

            {connected && live.isLoading ? (
              <div className="empty">Loading escrows from chain…</div>
            ) : connected && liveRows.length === 0 ? (
              <div className="empty">
                <p style={{ marginBottom: 8 }}>
                  You have no escrows yet — neither as payer nor as merchant.
                </p>
                <Link
                  href="/escrows/new"
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex" }}
                >
                  Open your first escrow →
                </Link>
              </div>
            ) : connected ? (
              liveRows.map((e) => {
                const id = e.publicKey.toBase58();
                const role =
                  wallet.publicKey?.toBase58() === e.account.payer.toBase58()
                    ? "Payer"
                    : "Merchant";
                const status = statusOf(e.account as { status: object });
                return (
                  <Link key={id} href={`/disputes/${id}`} className="table-row">
                    <div className="cell-id">{id.slice(0, 8)}…</div>
                    <div>
                      <div className="cell-matter">
                        {e.account.payer.toBase58().slice(0, 6)} → {e.account.merchant.toBase58().slice(0, 6)}
                      </div>
                      <div className="cell-matter-sub">
                        escrow id {String(e.account.escrowId)}
                      </div>
                    </div>
                    <div className="cell-amount">
                      {(Number(e.account.amount) / 1e6).toFixed(2)} USDC
                    </div>
                    <div>
                      <span className={STATUS_BADGE[status]}>
                        <span className="badge-dot" />
                        {status}
                      </span>
                    </div>
                    <div className="cell-time">—</div>
                    <div className="cell-time">{role}</div>
                  </Link>
                );
              })
            ) : (
              DEMO.map((r) => (
                <Link key={r.id} href={`/disputes/${r.id}`} className="table-row">
                  <div className="cell-id">{r.id}</div>
                  <div>
                    <div className="cell-matter">{r.matter}</div>
                    <div className="cell-matter-sub">{r.matterSub}</div>
                  </div>
                  <div className="cell-amount">{r.amount}</div>
                  <div>
                    <span className={STATUS_BADGE[r.status]}>
                      <span className="badge-dot" />
                      {r.status}
                    </span>
                  </div>
                  <div className="cell-time">{r.closes}</div>
                  <div className="cell-time">{r.role}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <aside className="layout-side">
          <div className="side-section">
            <div className="side-label">My positions</div>
            <SideMetric
              label="Open escrows"
              value={connected ? String(liveRows.length) : "2"}
            />
            <SideMetric label="As payer" value="3" />
            <SideMetric label="As merchant" value="1" />
            <SideMetric label="Locked value" value="$2,512" />
          </div>
          <div className="sep" />
          <div className="side-section">
            <div className="side-label">Tip</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              Click any escrow to open its case file. From there you can release
              funds, raise a dispute, or follow the juror panel.
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function SideMetric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="side-metric">
      <span className="side-metric-label">{label}</span>
      <span
        className="side-metric-val"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
