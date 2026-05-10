"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { useJurorForWallet, useResolvedDisputes } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import {
  claimJurorRewardIx,
  findJurorPda,
  findVotePda,
  registerJurorIx,
} from "@/lib/verdict-sdk";
import { shortAddr } from "@/lib/format";
import { explorerTxUrl } from "@/lib/config";
import EmptyState from "./EmptyState";

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
  Refund: "v-badge v-badge-gold",
  Release: "v-badge v-badge-blue",
};

const CASE_TABLE_COLS = "100px 1fr 90px 90px 90px 60px";

function tierOf(rep: number): { label: string; range: string; badgeClass: string } {
  if (rep >= 2500) return { label: "Tier IV", range: "2,500+", badgeClass: "v-badge v-badge-blue" };
  if (rep >= 1000) return { label: "Tier III", range: "1,000–2,499", badgeClass: "v-badge v-badge-gold" };
  if (rep >= 500)  return { label: "Tier II",  range: "500–999",     badgeClass: "v-badge v-badge-gold" };
  return { label: "Tier I", range: "0–499", badgeClass: "v-badge v-badge-gray" };
}

export default function JurorProfileView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const juror = useJurorForWallet(wallet.publicKey ?? null);
  const resolved = useResolvedDisputes();

  const [registering, setRegistering] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ text: string; sig?: string } | null>(null);

  const connected = !!wallet.publicKey;
  const isRegistered = !!juror.data?.account;
  const repValue = juror.data?.account?.reputation ?? 0;
  const casesVoted = juror.data?.account?.casesVoted ?? 0;

  async function handleRegister() {
    if (!program || !wallet.publicKey) return;
    setError(null);
    setInfo(null);
    setRegistering(true);
    try {
      const ix = await registerJurorIx(program, wallet.publicKey);
      const sig = await sendTx({ connection, wallet, ixs: [ix] });
      await qc.invalidateQueries({ queryKey: ["juror"] });
      setInfo({ text: "Registered as a juror.", sig });
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

  async function handleClaimAll() {
    if (!program || !wallet.publicKey || !resolved.data) return;
    setError(null);
    setInfo(null);
    setClaiming(true);
    let successes = 0;
    try {
      const [jurorPda] = findJurorPda(program.programId, wallet.publicKey);
      for (const d of resolved.data) {
        const [votePda] = findVotePda(program.programId, d.publicKey, jurorPda);
        const accInfo = await connection.getAccountInfo(votePda);
        if (!accInfo) continue;
        try {
          const ix = await claimJurorRewardIx(program, {
            authority: wallet.publicKey,
            dispute: d.publicKey,
          });
          await sendTx({ connection, wallet, ixs: [ix] });
          successes++;
        } catch (e) {
          console.warn("claim skipped for dispute", d.publicKey.toBase58(), e);
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["juror"] }),
        qc.invalidateQueries({ queryKey: ["disputes:resolved"] }),
      ]);
      setInfo({
        text:
          successes === 0
            ? "No claimable rewards found for this wallet."
            : `Claimed ${successes} reward${successes === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      setError(
        err instanceof TxError
          ? `${err.anchorCode ?? "tx"}: ${err.message}`
          : String(err),
      );
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <div className="v-page-header">
        <div>
          <div className="v-page-title">Juror Profile</div>
          <div className="v-page-subtitle">
            {connected ? (
              <>
                <span className="v-mono">{shortAddr(wallet.publicKey!)}</span>{" "}
                ·{" "}
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
            className="v-btn v-btn-primary v-btn-sm"
            onClick={handleRegister}
            disabled={registering || !program}
          >
            {registering ? (
              <>
                <span className="spinner" />
                Confirming…
              </>
            ) : (
              "Register as juror"
            )}
          </button>
        ) : connected ? (
          <button
            className="v-btn v-btn-primary v-btn-sm"
            onClick={handleClaimAll}
            disabled={claiming || !program}
          >
            {claiming ? (
              <>
                <span className="spinner" />
                Claiming…
              </>
            ) : (
              "Claim $42.00"
            )}
          </button>
        ) : (
          <button className="v-btn v-btn-primary v-btn-sm" onClick={() => setVisible(true)}>
            Connect wallet
          </button>
        )}
      </div>

      {error ? <Banner kind="error" text={error} /> : null}
      {info ? (
        <Banner
          kind="success"
          text={
            <>
              {info.text}
              {info.sig ? (
                <>
                  {" "}
                  <a
                    href={explorerTxUrl(info.sig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v-mono"
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      textDecoration: "underline",
                      marginLeft: 6,
                    }}
                  >
                    {shortAddr(info.sig)}
                  </a>
                </>
              ) : null}
            </>
          }
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          background: "var(--bg-subtle)",
          minHeight: "calc(100vh - 52px - 105px)",
        }}
      >
        <div style={{ padding: "20px 24px" }}>
          <div className="v-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div className="v-card v-stat">
              <div className="v-stat-label">Reputation</div>
              <div className="v-stat-value">
                {connected && isRegistered ? repValue : "—"}
              </div>
              <div
                className={connected && isRegistered ? "v-stat-delta delta-up" : "v-stat-delta"}
                style={!connected || !isRegistered ? { color: "var(--text-3)" } : undefined}
              >
                {connected && isRegistered ? "↑ 12 this week" : "Not registered"}
              </div>
            </div>
            <div className="v-card v-stat">
              <div className="v-stat-label">Cases voted</div>
              <div className="v-stat-value">
                {connected && isRegistered ? casesVoted : "—"}
              </div>
              <div className="v-stat-delta" style={{ color: "var(--text-3)" }}>
                94% majority aligned <span className="demo-tag">(demo)</span>
              </div>
            </div>
            <div className="v-card v-stat">
              <div className="v-stat-label">
                Pending rewards <span className="demo-tag">(demo)</span>
              </div>
              <div className="v-stat-value">$42.00</div>
              <div className="v-stat-delta delta-up">3 cases</div>
            </div>
          </div>

          {!connected ? (
            <div
              className="v-card"
              style={{ padding: 32, textAlign: "center", marginBottom: 16 }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                Connect your wallet
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
                Register as a juror, vote on disputes, and earn reputation by
                voting with the panel majority.
              </div>
              <button className="v-btn v-btn-primary" onClick={() => setVisible(true)}>
                Connect wallet
              </button>
            </div>
          ) : null}

          {connected && isRegistered ? (
            <div className="v-table" style={{ marginBottom: 16 }}>
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Tier progress</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {repValue.toLocaleString()} rep · {tierOf(repValue).range}
                  </div>
                </div>
                <span className={tierOf(repValue).badgeClass}>{tierOf(repValue).label}</span>
              </div>
              <div style={{ padding: 20 }}>
                <div
                  className="v-mono"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    marginBottom: 8,
                  }}
                >
                  <span>Tier I · 0</span>
                  <span>Tier II · 500</span>
                  <span>Tier III · 1,000</span>
                  <span>Tier IV · 2,500</span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--bg-muted)",
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--gold)",
                      borderRadius: 3,
                      width: `${Math.min((repValue / 2500) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {connected && casesVoted === 0 ? (
            <div className="v-table">
              <EmptyState
                icon="⚖"
                title="No cases voted yet"
                description="When a dispute is assigned to your panel it will appear in Active Disputes."
                action={
                  <a href="/disputes" className="v-btn v-btn-ghost v-btn-sm" style={{ display: "inline-flex" }}>
                    View disputes
                  </a>
                }
              />
            </div>
          ) : (
            <div className="v-table">
              <div className="v-thead" style={{ gridTemplateColumns: CASE_TABLE_COLS }}>
                <div className="v-th">Case</div>
                <div className="v-th">Matter</div>
                <div className="v-th">Your vote</div>
                <div className="v-th">Outcome</div>
                <div className="v-th">Reward</div>
                <div className="v-th">Aligned</div>
              </div>
              {DEMO_CASES.map((c) => (
                <div
                  key={c.id}
                  className="v-tr"
                  style={{ gridTemplateColumns: CASE_TABLE_COLS, cursor: "default" }}
                >
                  <div className="v-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {c.id}
                  </div>
                  <div style={{ fontSize: 13.5 }}>{c.matter}</div>
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
                    className="v-mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: c.reward ? "var(--green)" : "var(--text-3)",
                    }}
                  >
                    {c.reward ?? "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: c.yourVote === c.outcome ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {c.yourVote === c.outcome ? "✓" : "✗"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="v-layout-side">
          <div style={{ marginBottom: 24 }}>
            <div className="v-side-label">Juror details</div>
            <SideRow
              label="Wallet"
              value={connected ? shortAddr(wallet.publicKey!) : "—"}
            />
            <SideRow
              label="Registered"
              value={connected && isRegistered ? "On-chain" : connected ? "Not yet" : "—"}
            />
            <SideRow label="Active panels" value={isRegistered ? "1" : "0"} />
            <SideRow label="Majority rate" value="94%" valueColor="var(--green)" />
          </div>
          <div className="v-sep" />
          <div>
            <div className="v-side-label">
              Claimable rewards <span className="demo-tag">(demo)</span>
            </div>
            <SideRow label="ESC-0039" value="$14.00" valueColor="var(--green)" />
            <SideRow label="ESC-0037" value="$8.50" valueColor="var(--green)" />
            <SideRow label="ESC-0033" value="$19.50" valueColor="var(--green)" />
            <div className="v-sep" />
            <div className="v-side-row">
              <span style={{ fontWeight: 600 }}>Total</span>
              <span className="v-mono" style={{ color: "var(--green)", fontSize: 15, fontWeight: 500 }}>
                $42.00
              </span>
            </div>
            <button
              className="v-btn v-btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
              disabled={!connected || claiming || !program}
              onClick={handleClaimAll}
            >
              {claiming ? (
                <>
                  <span className="spinner" />
                  Confirming…
                </>
              ) : (
                "Claim all rewards"
              )}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Banner({
  kind,
  text,
}: {
  kind: "error" | "success";
  text: React.ReactNode;
}) {
  const c =
    kind === "error"
      ? { bg: "var(--red-bg)", border: "var(--red-border)", text: "var(--red)" }
      : {
          bg: "var(--green-bg)",
          border: "var(--green-border)",
          text: "var(--green)",
        };
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        padding: "10px 16px",
        margin: "16px 24px 0",
        borderRadius: 8,
        fontSize: 13,
        fontFamily: kind === "error" ? "var(--font-mono), monospace" : "inherit",
      }}
    >
      {text}
    </div>
  );
}

function SideRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="v-side-row">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span
        className="v-mono"
        style={{ fontWeight: 500, ...(valueColor ? { color: valueColor } : {}) }}
      >
        {value}
      </span>
    </div>
  );
}
