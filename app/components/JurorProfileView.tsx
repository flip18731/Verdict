"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { useJurorForWallet } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { registerJurorIx } from "@/lib/verdict-sdk";

interface CaseRow {
  id: string;
  matter: string;
  yourVote: "Refund" | "Release";
  outcome: "Refund" | "Release";
  reward: string | null;
}

const DEMO_CASES: CaseRow[] = [
  { id: "ESC-0039", matter: "Atlas v. RoomGraph", yourVote: "Refund", outcome: "Refund", reward: "+$14.00" },
  { id: "ESC-0037", matter: "PayDirect v. Acme", yourVote: "Release", outcome: "Release", reward: "+$8.50" },
  { id: "ESC-0034", matter: "Compose v. RenderForge", yourVote: "Refund", outcome: "Release", reward: null },
];

const VOTE_BADGE: Record<"Refund" | "Release", string> = {
  Refund: "badge badge-gold",
  Release: "badge badge-blue",
};

export default function JurorProfileView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const juror = useJurorForWallet(wallet.publicKey ?? null);

  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = !!wallet.publicKey;
  const isRegistered = !!juror.data?.account;
  const repValue = juror.data?.account?.reputation ?? 0;
  const casesVoted = juror.data?.account?.casesVoted ?? 0;

  async function handleRegister() {
    if (!program || !wallet.publicKey) return;
    setError(null);
    setRegistering(true);
    try {
      const ix = await registerJurorIx(program, wallet.publicKey);
      await sendTx({ connection, wallet, ixs: [ix] });
      await qc.invalidateQueries({ queryKey: ["juror"] });
    } catch (err) {
      setError(
        err instanceof TxError
          ? `${err.anchorCode ?? "tx"}: ${err.message}`
          : String(err),
      );
    } finally {
      setRegistering(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Juror Profile</div>
          <div className="page-subtitle">
            {connected ? (
              <>
                {wallet.publicKey?.toBase58().slice(0, 6)}…
                {wallet.publicKey?.toBase58().slice(-4)} ·{" "}
                {isRegistered
                  ? `${repValue} reputation · ${casesVoted} cases voted`
                  : "Not registered yet"}
              </>
            ) : (
              "Connect a wallet to register as a juror"
            )}
          </div>
        </div>
        {connected && !isRegistered ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRegister}
            disabled={registering || !program}
          >
            {registering ? "Registering…" : "Register as juror"}
          </button>
        ) : connected ? (
          <button className="btn btn-primary btn-sm">Claim rewards</button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setVisible(true)}
          >
            Connect wallet
          </button>
        )}
      </div>

      {error ? (
        <div
          style={{
            background: "var(--red-bg)",
            border: "1px solid var(--red-border)",
            color: "var(--red)",
            padding: "10px 16px",
            margin: "16px 24px 0",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {error}
        </div>
      ) : null}

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
              <div className="stat-value">
                {connected && isRegistered ? repValue : "—"}
              </div>
              <div
                className={
                  connected && isRegistered ? "stat-delta delta-up" : "stat-delta"
                }
                style={
                  !connected || !isRegistered
                    ? { color: "var(--text-3)" }
                    : undefined
                }
              >
                {connected && isRegistered ? "↑ 12 this week" : "Not registered"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cases voted</div>
              <div className="stat-value">
                {connected && isRegistered ? casesVoted : "—"}
              </div>
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

          {/* Connect prompt */}
          {!connected ? (
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                marginBottom: 16,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                Connect your wallet
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  marginBottom: 16,
                }}
              >
                Register as a juror, vote on disputes, and earn reputation by
                voting with the panel majority.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setVisible(true)}
              >
                Connect wallet
              </button>
            </div>
          ) : null}

          {/* Tier progress */}
          {connected && isRegistered ? (
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
                  <div className="section-sub">{repValue} / 1,000 to Tier III</div>
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
                  <div
                    className="tier-fill"
                    style={{
                      width: `${Math.min((repValue / 2500) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Recent cases — demo data when no wallet, empty when no votes */}
          {connected && casesVoted === 0 ? (
            <div className="table-wrap">
              <div className="empty">
                You haven&rsquo;t voted on any cases yet. When a dispute is
                assigned to your panel, it will appear in{" "}
                <a href="/disputes" style={{ color: "var(--text-1)" }}>
                  Active Disputes
                </a>
                .
              </div>
            </div>
          ) : (
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
              {DEMO_CASES.map((c) => (
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
          )}
        </div>

        <aside className="layout-side">
          <div className="side-section">
            <div className="side-label">Juror details</div>
            <SideMetric
              label="Wallet"
              value={
                connected
                  ? `${wallet.publicKey!.toBase58().slice(0, 4)}…${wallet.publicKey!.toBase58().slice(-4)}`
                  : "—"
              }
            />
            <SideMetric
              label="Registered"
              value={connected && isRegistered ? "On-chain" : connected ? "Not yet" : "—"}
            />
            <SideMetric label="Active panels" value={isRegistered ? "1" : "0"} />
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
              disabled={!connected}
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
