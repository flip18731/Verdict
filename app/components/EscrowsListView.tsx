"use client";

import Link from "next/link";

interface EscrowRow {
  id: string;
  matter: string;
  matterSub: string;
  amount: string;
  status: "Funded" | "Released" | "Disputed" | "Refunded";
  closes: string;
  role: "Payer" | "Merchant";
}

const ROWS: EscrowRow[] = [
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

const STATUS_BADGE: Record<EscrowRow["status"], string> = {
  Funded: "badge badge-blue",
  Released: "badge badge-green",
  Disputed: "badge badge-gold",
  Refunded: "badge badge-gold",
};

export default function EscrowsListView() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">My Escrows</div>
          <div className="page-subtitle">
            Every escrow where you are payer or merchant
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
          <div className="table-wrap">
            <div className="table-head">
              <div className="th">Case</div>
              <div className="th">Matter</div>
              <div className="th">Amount</div>
              <div className="th">Status</div>
              <div className="th">Closes</div>
              <div className="th">Role</div>
            </div>
            {ROWS.map((r) => (
              <Link
                key={r.id}
                href={`/disputes/${r.id}`}
                className="table-row"
              >
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
            ))}
          </div>
        </div>

        <aside className="layout-side">
          <div className="side-section">
            <div className="side-label">My positions</div>
            <SideMetric label="Open escrows" value="2" />
            <SideMetric label="As payer" value="3" />
            <SideMetric label="As merchant" value="1" />
            <SideMetric
              label="Locked value"
              value="$2,512"
              valueColor="var(--text-1)"
            />
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
