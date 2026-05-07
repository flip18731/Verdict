"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

type VoteChoice = "refund" | "release";

interface JurorTile {
  id: string;
  addr: string;
  rep: number;
  tier: string;
  you: boolean;
  vote: VoteChoice | null;
  seated: boolean;
}

interface FeedRow {
  time: string;
  action: React.ReactNode;
  sig: string;
}

const ESC_AMOUNT_USDC = 2500;
const PETITIONER_ADDR = "5xKpT…4wRq";
const RESPONDENT_ADDR = "Bq4T…9wLk";
const VAULT_ADDR = "Bq4T…9wLk";
const EVIDENCE_URI = "ipfs://QmX7vK9wR3mN2pL8qT4sF6hJ1bD5cA0eW/dispute-evidence.json";

const INITIAL_JURORS: JurorTile[] = [
  { id: "J", addr: "4xKpT…9wRq", rep: 847, tier: "II", you: true, vote: null, seated: true },
  { id: "B", addr: "Bq4T…9wLk", rep: 1240, tier: "III", you: false, vote: "refund", seated: true },
  { id: "M", addr: "Mn7R…3kPx", rep: 562, tier: "II", you: false, vote: null, seated: true },
];

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}
interface NavSection {
  head: string;
  items: NavItem[];
}
const NAV: NavSection[] = [
  {
    head: "Chambers",
    items: [
      { id: "disputes", label: "Active Disputes", icon: "⚖", badge: "3" },
      { id: "all-cases", label: "All Cases", icon: "📋" },
    ],
  },
  {
    head: "Escrows",
    items: [
      { id: "create", label: "Create Escrow", icon: "↗" },
      { id: "my-escrows", label: "My Escrows", icon: "📑", badge: "7" },
    ],
  },
  {
    head: "Jurors",
    items: [
      { id: "profile", label: "My Profile", icon: "★" },
      { id: "registry", label: "Registry", icon: "👤" },
    ],
  },
  {
    head: "Protocol",
    items: [
      { id: "analytics", label: "Analytics", icon: "📊" },
      { id: "settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export default function VerdictDashboard() {
  const [activeNav, setActiveNav] = useState("disputes");
  const [voted, setVoted] = useState<VoteChoice | null>(null);
  const [resolved, setResolved] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [jurors, setJurors] = useState<JurorTile[]>(INITIAL_JURORS);
  const [secondsLeft, setSecondsLeft] = useState(3 * 3600 + 42 * 60 + 17);
  const [castFeed, setCastFeed] = useState<FeedRow | null>(null);

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

  const handleVote = (choice: VoteChoice) => {
    if (voted || resolved || animating) return;
    setVoted(choice);
    setJurors((prev) => prev.map((j) => (j.you ? { ...j, vote: choice } : j)));
    setCastFeed({
      time: "now",
      action: (
        <>
          You cast vote · <span className="verdict-word">{choice}</span>
        </>
      ),
      sig: `sig ${randomSig()}`,
    });
    // TODO: wire to castVoteIx from verdict-sdk
  };

  const handleResolve = () => {
    if (!voted || resolved || animating) return;
    setAnimating(true);
    // TODO: wire to resolveDisputeIx from verdict-sdk
    setTimeout(() => {
      setAnimating(false);
      setResolved(true);
    }, 2000);
  };

  const verdictOutcome: VoteChoice = useMemo(() => {
    const refundVotes = jurors.filter((j) => j.vote === "refund").length;
    const releaseVotes = jurors.filter((j) => j.vote === "release").length;
    if (refundVotes > releaseVotes) return "refund";
    if (releaseVotes > refundVotes) return "release";
    return "release"; // tie defaults to release
  }, [jurors]);

  return (
    <div className="v-app">
      <Topbar />
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
      <main className="v-main">
        <SectionHead timer={timer} />
        <CaseFile />
        {resolved ? (
          <VerdictBanner outcome={verdictOutcome} />
        ) : (
          <ActionRow
            voted={voted}
            resolved={resolved}
            animating={animating}
            onVote={handleVote}
            onResolve={handleResolve}
          />
        )}
        <JurorPanel jurors={jurors} />
      </main>
      <RightRail castFeed={castFeed} />
    </div>
  );
}

/* ============================================================ */
/* Topbar                                                       */
/* ============================================================ */

function Topbar() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const pub = wallet.publicKey?.toBase58();
  const label = pub ? `${pub.slice(0, 4)}…${pub.slice(-4)}` : "Connect Wallet";

  return (
    <div className="v-topbar">
      <div className="v-brand">
        <div className="v-mark">
          <span className="v-mark-letter">V</span>
        </div>
        <div className="v-wordmark">
          <span className="lead">V</span>ERDICT
        </div>
        <div className="v-vol">VOL. IV · FRONTIER 2026</div>
      </div>
      <div className="v-search">
        <SearchIcon />
        <input placeholder="Search by escrow id, juror, hash…" spellCheck={false} />
      </div>
      <div className="v-topbar-right">
        <div className="v-net">
          <span className="v-net-dot" />
          <span>MAINNET · SOL</span>
        </div>
        <button
          className="v-wallet-btn"
          onClick={() => {
            if (pub) {
              wallet.disconnect().catch(() => undefined);
            } else {
              setVisible(true);
            }
          }}
        >
          <WalletIcon />
          <span>{label}</span>
        </button>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="v-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h18v12H3z" />
      <path d="M3 7l3-4h12l3 4" />
      <circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ============================================================ */
/* Sidebar                                                      */
/* ============================================================ */

function Sidebar({
  activeNav,
  setActiveNav,
}: {
  activeNav: string;
  setActiveNav: (id: string) => void;
}) {
  return (
    <aside className="v-sidebar">
      {NAV.map((section) => (
        <div key={section.head}>
          <div className="v-side-head">{section.head}</div>
          <div className="v-nav">
            {section.items.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  className={`v-nav-item${active ? " active" : ""}`}
                  onClick={() => setActiveNav(item.id)}
                >
                  <span className="v-nav-icon">{item.icon}</span>
                  <span className="v-nav-label">{item.label}</span>
                  {item.badge && <span className="v-badge">{item.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <SidebarJurorCard />
    </aside>
  );
}

function SidebarJurorCard() {
  return (
    <div className="v-juror-card">
      <div className="v-juror-row">
        <div className="v-avatar">J</div>
        <div>
          <div className="v-juror-name">Juror 4xKpT</div>
          <div className="v-juror-addr">4xKpT…9wRq</div>
        </div>
      </div>
      <div className="v-rep-bar">
        <div className="v-rep-fill" style={{ width: "72%" }} />
      </div>
      <div className="v-rep-meta">REP 847 / TIER II</div>
    </div>
  );
}

/* ============================================================ */
/* Section head + Case file                                     */
/* ============================================================ */

function SectionHead({ timer }: { timer: string }) {
  return (
    <div className="v-section-head">
      <div>
        <div className="v-eyebrow">§ II · ACTIVE DISPUTE</div>
        <h1 className="v-h1">
          Dispute <span className="case-id">ESC-0042</span>
        </h1>
        <div className="v-section-meta">OPENED 5m AGO · VOTING ENDS IN 3h 42m · PANEL SEATED</div>
      </div>
      <div>
        <div className="v-timer">
          <div className="v-timer-val">{timer}</div>
          <div className="v-timer-lbl">REMAINING</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="v-status-badge">⚖ AWAITING VERDICT</span>
        </div>
      </div>
    </div>
  );
}

function CaseFile() {
  return (
    <div className="v-case">
      <div className="v-case-top">
        <div>
          <div className="v-label">The Matter</div>
          <div className="v-matter">
            Helios Research Agent v. DataSpring MCP · Failure to Deliver Dataset
          </div>
        </div>
        <div>
          <div className="v-label" style={{ textAlign: "right" }}>Escrow</div>
          <div className="v-amount">$2,500.00 USDC</div>
          <div className="v-amount-sub">vault {VAULT_ADDR}</div>
        </div>
      </div>
      <div className="v-case-grid">
        <CaseCell label="Petitioner" value={PETITIONER_ADDR} />
        <CaseCell label="Respondent" value={RESPONDENT_ADDR} />
        <CaseCell label="Filed" value="5 minutes ago" />
        <CaseCell label="Panel Size" value="3 jurors" />
      </div>
      <div className="v-evidence">
        <FileIcon />
        <div style={{ flex: 1 }}>
          <div className="v-label">Evidence URI · IPFS</div>
          <div className="v-evidence-uri">{EVIDENCE_URI}</div>
        </div>
      </div>
    </div>
  );
}

function CaseCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="v-case-cell">
      <div className="v-label">{label}</div>
      <div className="v-val">{value}</div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="v-evidence-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

/* ============================================================ */
/* Action row + Verdict banner                                  */
/* ============================================================ */

function ActionRow({
  voted,
  resolved,
  animating,
  onVote,
  onResolve,
}: {
  voted: VoteChoice | null;
  resolved: boolean;
  animating: boolean;
  onVote: (c: VoteChoice) => void;
  onResolve: () => void;
}) {
  const voteDisabled = voted !== null || resolved || animating;
  const resolveDisabled = !voted || resolved || animating;

  return (
    <div className="v-actions">
      <button
        className="v-act v-act-refund"
        disabled={voteDisabled}
        onClick={() => onVote("refund")}
      >
        <span className="lead">↩ Vote · Refund Petitioner</span>
        <span className="meta">{voted === "refund" ? "VOTE CAST" : "RETURN VAULT TO PAYER"}</span>
      </button>
      <button
        className="v-act v-act-release"
        disabled={voteDisabled}
        onClick={() => onVote("release")}
      >
        <span className="lead">↗ Vote · Release to Merchant</span>
        <span className="meta">{voted === "release" ? "VOTE CAST" : "DELIVER FUNDS TO RESPONDENT"}</span>
      </button>
      <button
        className="v-act v-act-resolve"
        disabled={resolveDisabled}
        onClick={onResolve}
      >
        <span className="lead">{animating ? "Sealing…" : "⚖ Render Verdict"}</span>
        <span className="meta">
          {animating ? "SIGNING ON-CHAIN" : voted ? "TALLY & SETTLE" : "AWAITING YOUR VOTE"}
        </span>
      </button>
    </div>
  );
}

function VerdictBanner({ outcome }: { outcome: VoteChoice }) {
  const word = outcome === "refund" ? "Refund" : "Release";
  const recipient = outcome === "refund" ? "petitioner" : "respondent";
  const verb = outcome === "refund" ? "refunded" : "released";
  return (
    <div className="v-verdict">
      <div className="v-verdict-eye">⚖ VERDICT RENDERED — ESC-0042</div>
      <div className="v-verdict-word">{word}</div>
      <div className="v-verdict-line">
        escrow {verb} · {recipient} receives {ESC_AMOUNT_USDC.toLocaleString()} USDC
      </div>
    </div>
  );
}

/* ============================================================ */
/* Juror panel                                                  */
/* ============================================================ */

function JurorPanel({ jurors }: { jurors: JurorTile[] }) {
  const seated = jurors.filter((j) => j.seated).length;
  const voted = jurors.filter((j) => j.vote !== null).length;
  return (
    <section>
      <div className="v-panel-head">
        <div className="v-panel-title">Juror Panel</div>
        <div className="v-panel-meta">
          {seated} SEATED · {voted}/3 VOTED · STAKE 50 USDC EACH
        </div>
      </div>
      <div className="v-jurors">
        {jurors.map((j) => (
          <JurorTileCard key={j.id + j.addr} juror={j} />
        ))}
      </div>
    </section>
  );
}

function JurorTileCard({ juror }: { juror: JurorTile }) {
  const stateClass =
    juror.vote === "refund"
      ? " voted-refund"
      : juror.vote === "release"
        ? " voted-release"
        : "";
  const youClass = juror.you ? " you" : "";

  return (
    <div className={`v-juror-tile${stateClass}${youClass}`}>
      <div className="v-juror-tile-row">
        <div className="v-avatar sm">{juror.id}</div>
        <div>
          <div className="v-juror-tile-name">
            {juror.you ? "You" : juror.addr}
          </div>
          <div className="v-juror-tile-rep">
            REP {juror.rep} · TIER {juror.tier}
          </div>
        </div>
      </div>
      <div
        className={`v-juror-vote ${
          juror.vote === "refund"
            ? "refund"
            : juror.vote === "release"
              ? "release"
              : "awaiting"
        }`}
      >
        {juror.vote === "refund"
          ? "voted refund"
          : juror.vote === "release"
            ? "voted release"
            : "AWAITING"}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Right rail                                                   */
/* ============================================================ */

function RightRail({ castFeed }: { castFeed: FeedRow | null }) {
  return (
    <aside className="v-rail">
      <LiveLedger castFeed={castFeed} />
      <ActiveDocket />
      <CourtMetrics />
    </aside>
  );
}

const STATIC_FEED: FeedRow[] = [
  {
    time: "14s",
    action: (
      <>
        Juror <span className="pk">Bq4T…9wLk</span> seated to panel
      </>
    ),
    sig: `sig 8vRjN2…pXq1`,
  },
  {
    time: "2m",
    action: <>Petitioner filed evidence to IPFS</>,
    sig: `sig 3kQwM7…rT4n`,
  },
  {
    time: "5m",
    action: (
      <>
        Dispute ESC-0042 opened against <span className="pk">Bq4T…9wLk</span>
      </>
    ),
    sig: `sig 9aBxV1…cF2z`,
  },
  {
    time: "11m",
    action: (
      <>
        Verdict rendered for ESC-0040 · <span className="verdict-word">release</span>
      </>
    ),
    sig: `sig 2nLpK5…hY8w`,
  },
];

function LiveLedger({ castFeed }: { castFeed: FeedRow | null }) {
  const rows = castFeed ? [castFeed, ...STATIC_FEED] : STATIC_FEED;
  return (
    <section className="v-rail-section">
      <div className="v-rail-head">
        <div className="v-rail-title">Live Ledger</div>
        <div className="v-rail-aux">CONFIRMED · LATEST 4</div>
      </div>
      <div className="v-feed">
        {rows.map((r, i) => (
          <div className="v-feed-row" key={i}>
            <div className="v-feed-time">{r.time}</div>
            <div className="v-feed-body">
              <div className="v-feed-action">{r.action}</div>
              <div className="v-feed-sig">{r.sig}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const DOCKET = [
  { id: "ESC-0042", amt: "2,500 USDC", status: "Disputed" as const },
  { id: "ESC-0041", amt: "850 USDC", status: "Funded" as const },
  { id: "ESC-0040", amt: "12,000 USDC", status: "Released" as const },
  { id: "ESC-0038", amt: "400 USDC", status: "Funded" as const },
];

function ActiveDocket() {
  return (
    <section className="v-rail-section">
      <div className="v-rail-head">
        <div className="v-rail-title">Active Docket</div>
        <div className="v-rail-aux">4 OF 7</div>
      </div>
      <div className="v-docket">
        {DOCKET.map((d) => (
          <div className="v-docket-row" key={d.id}>
            <span className="id">{d.id}</span>
            <span className="amt">{d.amt}</span>
            <span
              className={
                d.status === "Disputed"
                  ? "v-pill v-pill-disputed"
                  : d.status === "Funded"
                    ? "v-pill v-pill-funded"
                    : "v-pill v-pill-released"
              }
            >
              {d.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const METRICS = [
  { label: "Total Verdicts", num: "1,248", delta: "+34", up: true },
  { label: "Active Jurors", num: "412", delta: "+8", up: true },
  { label: "TVL · Escrows", num: "$4.2M", delta: "−2.1%", up: false },
  { label: "Median Resolution", num: "3.4h", delta: "−12m", up: true },
];

function CourtMetrics() {
  return (
    <section className="v-rail-section">
      <div className="v-rail-head">
        <div className="v-rail-title">Court Metrics</div>
        <div className="v-rail-aux">24H</div>
      </div>
      <div>
        {METRICS.map((m) => (
          <div className="v-metric-row" key={m.label}>
            <div className="v-metric-label">{m.label}</div>
            <div className="v-metric-vals">
              <span className="v-metric-num">{m.num}</span>
              <span className={m.up ? "v-delta-up" : "v-delta-down"}>{m.delta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/* Helpers                                                      */
/* ============================================================ */

function randomSig() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "…" + chars[0] + chars[1] + chars[2] + chars[3];
}
