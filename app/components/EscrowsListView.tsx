"use client";

import Link from "next/link";
import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
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
  Funded: "badge badge-blue",
  Released: "badge badge-green",
  Disputed: "badge badge-gold",
  Refunded: "badge badge-gold",
};

type StatusKey = keyof typeof STATUS_BADGE;
function statusOf(account: { status: object }): StatusKey {
  if ("disputed" in account.status) return "Disputed";
  if ("released" in account.status) return "Released";
  if ("refunded" in account.status) return "Refunded";
  return "Funded";
}

type Action = { kind: "release" | "raise"; row: WithKey<Escrow> };

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
  const [info, setInfo] = useState<string | null>(null);

  const connected = !!wallet.publicKey;
  const liveRows = live.data ?? [];

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
        // Bootstrap merchant ATA if missing — release_escrow can't create it.
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

      await sendTx({ connection, wallet, ixs });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["escrows"] }),
        qc.invalidateQueries({ queryKey: ["disputes:open"] }),
      ]);
      setInfo(
        pending.kind === "release"
          ? "Escrow released."
          : "Dispute raised. Jurors can now vote.",
      );
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

      {error ? (
        <Banner kind="error" text={error} />
      ) : info ? (
        <Banner kind="success" text={info} />
      ) : null}

      <div className="layout">
        <div className="layout-main">
          {!connected ? (
            <Banner
              kind="info"
              text={
                <>
                  Showing example escrows. Connect a wallet to see your real
                  positions.
                </>
              }
              cta={{ label: "Connect wallet", onClick: () => setVisible(true) }}
              inline
            />
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
                const isPayer = role === "Payer";
                const canAct = isPayer && status === "Funded";

                return (
                  <div key={id} className="table-row" style={{ cursor: "default" }}>
                    <div className="cell-id">{id.slice(0, 8)}…</div>
                    <div>
                      <div className="cell-matter">
                        {e.account.payer.toBase58().slice(0, 6)} →{" "}
                        {e.account.merchant.toBase58().slice(0, 6)}
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
                    <div className="cell-time">{role}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {canAct ? (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              setPending({ kind: "release", row: e })
                            }
                            disabled={busy}
                          >
                            Release
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setPending({ kind: "raise", row: e })
                            }
                            disabled={busy}
                          >
                            Dispute
                          </button>
                        </>
                      ) : status === "Disputed" ? (
                        <Link
                          href={`/disputes/${id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </Link>
                      ) : (
                        <span
                          style={{ fontSize: 12, color: "var(--text-3)" }}
                        >
                          —
                        </span>
                      )}
                    </div>
                  </div>
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
            <SideMetric
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
            <SideMetric
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
          <div className="sep" />
          <div className="side-section">
            <div className="side-label">Tip</div>
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
              {pending
                ? (Number(pending.row.account.amount) / 1e6).toFixed(2)
                : "—"}{" "}
              USDC
            </strong>{" "}
            from the vault to the merchant and closes both accounts atomically.
            The action is final and cannot be undone.
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
              className="field-label"
              style={{ display: "block", marginBottom: 6 }}
            >
              Evidence URI
            </label>
            <input
              className="field-input mono-input"
              placeholder="ipfs:// or https://"
              value={evidenceUri}
              onChange={(e) => setEvidenceUri(e.target.value)}
              disabled={busy}
            />
            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-3)",
                marginTop: 6,
              }}
            >
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
  cta,
  inline,
}: {
  kind: "error" | "success" | "info";
  text: React.ReactNode;
  cta?: { label: string; onClick: () => void };
  inline?: boolean;
}) {
  const color =
    kind === "error"
      ? { bg: "var(--red-bg)", border: "var(--red-border)", text: "var(--red)" }
      : kind === "success"
        ? {
            bg: "var(--green-bg)",
            border: "var(--green-border)",
            text: "var(--green)",
          }
        : { bg: "var(--bg)", border: "var(--border)", text: "var(--text-2)" };
  return (
    <div
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        color: color.text,
        padding: "10px 16px",
        margin: inline ? "0 0 16px" : "16px 24px 0",
        borderRadius: 8,
        fontSize: 13,
        fontFamily:
          kind === "error" ? "var(--font-mono), monospace" : "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: inline ? "var(--shadow-sm)" : undefined,
      }}
    >
      <div>{text}</div>
      {cta ? (
        <button className="btn btn-primary btn-sm" onClick={cta.onClick}>
          {cta.label}
        </button>
      ) : null}
    </div>
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
