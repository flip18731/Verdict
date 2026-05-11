"use client";

import Link from "next/link";
import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import EmptyState from "./EmptyState";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { type TransactionInstruction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  findVaultPda,
  raiseDisputeIx,
  releaseEscrowIx,
  type Escrow,
} from "@/lib/verdict-sdk";
import { useEscrowsForWallet, type WithKey } from "@/lib/queries";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { shortAddr, formatUsdc } from "@/lib/format";
import { explorerTxUrl } from "@/lib/config";
import ConfirmModal from "./ConfirmModal";

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
  Funded: "v-badge v-badge-blue",
  Released: "v-badge v-badge-green",
  Disputed: "v-badge v-badge-gold",
  Refunded: "v-badge v-badge-gold",
};

type StatusKey = keyof typeof STATUS_BADGE;
function statusOf(account: { status: object }): StatusKey {
  if ("disputed" in account.status) return "Disputed";
  if ("released" in account.status) return "Released";
  if ("refunded" in account.status) return "Refunded";
  return "Funded";
}

type Action = { kind: "release" | "raise"; row: WithKey<Escrow> };
type FilterTab = "All" | "Funded" | "Disputed" | "Released" | "Refunded";
const FILTER_TABS: FilterTab[] = ["All", "Funded", "Disputed", "Released", "Refunded"];
const TABLE_COLS = "100px 1fr 110px 110px 90px 1fr";
const DEFAULT_VOTING_WINDOW_SECONDS = 6 * 3600;

export default function EscrowsListView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const live = useEscrowsForWallet(wallet.publicKey ?? null);

  const [pending, setPending] = useState<Action | null>(null);
  const [evidenceUri, setEvidenceUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ text: string; sig?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  const connected = !!wallet.publicKey;
  const liveRows = live.data ?? [];
  const filteredRows = activeFilter === "All"
    ? liveRows
    : liveRows.filter((e) => statusOf(e.account as { status: object }) === activeFilter);

  async function executeAction() {
    if (!pending || !program || !wallet.publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const e = pending.row;
      const merchantAta = getAssociatedTokenAddressSync(
        e.account.mint,
        e.account.merchant,
      );
      const ixs: TransactionInstruction[] = [];

      if (pending.kind === "release") {
        const ataInfo = await connection.getAccountInfo(merchantAta);
        if (!ataInfo) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              merchantAta,
              e.account.merchant,
              e.account.mint,
              TOKEN_PROGRAM_ID,
            ),
          );
        }
        const [vault] = findVaultPda(program.programId, e.publicKey);
        ixs.push(
          await releaseEscrowIx(program, {
            payer: wallet.publicKey,
            escrow: e.publicKey,
            vault,
            merchantTokenAccount: merchantAta,
          }),
        );
      } else {
        ixs.push(
          await raiseDisputeIx(program, {
            payer: wallet.publicKey,
            escrow: e.publicKey,
            evidenceUri: evidenceUri || "ipfs://demo-evidence",
            votingWindowSeconds: new BN(DEFAULT_VOTING_WINDOW_SECONDS),
          }),
        );
      }

      const sig = await sendTx({ connection, wallet, ixs });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["escrows"] }),
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
      ]);
      setInfo({
        text:
          pending.kind === "release"
            ? "Escrow released."
            : "Dispute raised. Jurors can now vote.",
        sig,
      });
      setPending(null);
      setEvidenceUri("");
    } catch (err) {
      setError(
        err instanceof TxError
          ? `${err.anchorCode ?? "tx"}: ${err.message}`
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="v-page-header">
        <div>
          <div className="v-page-title">My Escrows</div>
          <div className="v-page-subtitle">
            {connected
              ? "Every escrow where you are payer or merchant"
              : "Connect a wallet to see your escrows"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="v-btn v-btn-ghost v-btn-sm">Filter</button>
          <Link href="/escrows/new" className="v-btn v-btn-primary v-btn-sm">
            New escrow
          </Link>
        </div>
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

      {connected ? (
        <div className="filter-pills" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              className={`filter-pill${activeFilter === tab ? " active" : ""}`}
              onClick={() => setActiveFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : null}

      <div className="v-layout">
        <div className="v-layout-main">
          {!connected ? (
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
                Showing example escrows. Connect a wallet to see your real positions.
              </div>
              <button
                className="v-btn v-btn-primary v-btn-sm"
                onClick={() => setVisible(true)}
              >
                Connect wallet
              </button>
            </div>
          ) : null}

          <div className="v-table">
            <div className="v-thead" style={{ gridTemplateColumns: TABLE_COLS }}>
              <div className="v-th">Case</div>
              <div className="v-th">Matter</div>
              <div className="v-th" style={{ textAlign: "right" }}>Amount</div>
              <div className="v-th">Status</div>
              <div className="v-th">Role</div>
              <div className="v-th">Action</div>
            </div>

            {connected && live.isLoading ? (
              <EmptyState
                icon="📑"
                title="Loading escrows…"
                description="Fetching your positions from the chain."
              />
            ) : connected && liveRows.length === 0 ? (
              <EmptyState
                icon="📑"
                title="No escrows yet"
                description="You have no escrows — neither as payer nor as merchant."
                action={
                  <Link href="/escrows/new" className="v-btn v-btn-primary v-btn-sm" style={{ display: "inline-flex" }}>
                    Open your first escrow →
                  </Link>
                }
              />
            ) : connected && filteredRows.length === 0 ? (
              <EmptyState
                title={`No ${activeFilter.toLowerCase()} escrows`}
                description="Try a different filter."
              />
            ) : connected ? (
              filteredRows.map((e) => {
                const id = e.publicKey.toBase58();
                const role =
                  wallet.publicKey?.toBase58() === e.account.payer.toBase58()
                    ? "Payer"
                    : "Merchant";
                const status = statusOf(e.account as { status: object });
                const isPayer = role === "Payer";
                const canAct = isPayer && status === "Funded";

                return (
                  <div
                    key={id}
                    className="v-tr"
                    style={{ gridTemplateColumns: TABLE_COLS, cursor: "default" }}
                  >
                    <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                      {shortAddr(id)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5 }}>
                        <span className="v-mono">{shortAddr(e.account.payer)}</span> →{" "}
                        <span className="v-mono">{shortAddr(e.account.merchant)}</span>
                      </div>
                      <div className="v-mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        escrow id {String(e.account.escrowId)}
                      </div>
                    </div>
                    <div
                      className="v-mono"
                      style={{ fontSize: 13, fontWeight: 500, textAlign: "right" }}
                    >
                      {formatUsdc(e.account.amount)} USDC
                    </div>
                    <div>
                      <span className={STATUS_BADGE[status]}>
                        <span className="v-badge-dot" />
                        {status}
                      </span>
                    </div>
                    <div className="v-mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                      {role}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {canAct ? (
                        <>
                          <button
                            className="v-btn v-btn-primary v-btn-sm"
                            onClick={() => setPending({ kind: "release", row: e })}
                            disabled={busy}
                          >
                            Release
                          </button>
                          <button
                            className="v-btn v-btn-ghost v-btn-sm"
                            onClick={() => setPending({ kind: "raise", row: e })}
                            disabled={busy}
                          >
                            Dispute
                          </button>
                        </>
                      ) : status === "Disputed" ? (
                        <Link href={`/disputes/${id}`} className="v-btn v-btn-ghost v-btn-sm">
                          View
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              DEMO.map((r) => (
                <Link
                  key={r.id}
                  href={`/disputes/${r.id}`}
                  className="v-tr"
                  style={{ gridTemplateColumns: TABLE_COLS }}
                >
                  <div className="v-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                    {r.id}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5 }}>{r.matter}</div>
                    <div className="v-mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {r.matterSub}
                    </div>
                  </div>
                  <div
                    className="v-mono"
                    style={{ fontSize: 13, fontWeight: 500, textAlign: "right" }}
                  >
                    {r.amount}
                  </div>
                  <div>
                    <span className={STATUS_BADGE[r.status]}>
                      <span className="v-badge-dot" />
                      {r.status}
                    </span>
                  </div>
                  <div className="v-mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    {r.role}
                  </div>
                  <div className="v-mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                    {r.closes}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <aside className="v-layout-side">
          <div style={{ marginBottom: 24 }}>
            <div className="v-side-label">My positions</div>
            <SideRow
              label="Open escrows"
              value={connected ? String(liveRows.length) : "2"}
            />
            <SideRow
              label="Funded"
              value={
                connected
                  ? String(
                      liveRows.filter(
                        (r) => statusOf(r.account as { status: object }) === "Funded",
                      ).length,
                    )
                  : "1"
              }
            />
            <SideRow
              label="Disputed"
              value={
                connected
                  ? String(
                      liveRows.filter(
                        (r) => statusOf(r.account as { status: object }) === "Disputed",
                      ).length,
                    )
                  : "1"
              }
            />
          </div>
          <div className="v-sep" />
          <div>
            <div className="v-side-label">Tip</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              Click <strong>Release</strong> to pay the merchant, or{" "}
              <strong>Dispute</strong> to send the case to a juror panel. Both
              actions are on-chain and irreversible.
            </div>
          </div>
        </aside>
      </div>

      <ConfirmModal
        open={pending?.kind === "release"}
        title="Release the escrow?"
        body={
          <>
            This pays{" "}
            <strong>
              {pending ? formatUsdc(pending.row.account.amount) : "—"} USDC
            </strong>{" "}
            from the vault to{" "}
            <span className="v-mono">
              {pending ? shortAddr(pending.row.account.merchant) : "—"}
            </span>{" "}
            and closes both accounts atomically. The action is final and cannot
            be undone.
          </>
        }
        confirmLabel="Release funds"
        confirmTone="primary"
        onConfirm={executeAction}
        onCancel={() => setPending(null)}
        busy={busy}
      />

      <ConfirmModal
        open={pending?.kind === "raise"}
        title="Raise a dispute?"
        body={
          <>
            <p style={{ marginBottom: 12 }}>
              This opens a dispute on this escrow. A juror panel will rule
              within the voting window (6 hours). The vault stays locked until
              the panel resolves.
            </p>
            <label
              className="v-field-label"
              style={{ display: "block", marginBottom: 6 }}
            >
              Evidence URI
            </label>
            <input
              className="v-field-input v-mono"
              placeholder="ipfs:// or https://"
              value={evidenceUri}
              onChange={(e) => setEvidenceUri(e.target.value)}
              disabled={busy}
            />
            <div className="v-field-hint">
              Stored opaquely on-chain (max 256 chars). Defaults to{" "}
              <code>ipfs://demo-evidence</code> if left blank.
            </div>
          </>
        }
        confirmLabel="Open dispute"
        confirmTone="primary"
        onConfirm={executeAction}
        onCancel={() => {
          setPending(null);
          setEvidenceUri("");
        }}
        busy={busy}
      />
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
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="v-side-row">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span className="v-mono" style={{ fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
