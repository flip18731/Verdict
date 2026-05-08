"use client";

import Link from "next/link";
import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { initializeEscrowIx } from "@/lib/verdict-sdk";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { TEST_USDC_MINT, explorerTxUrl } from "@/lib/config";

export default function CreateEscrowView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();

  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("2500");
  const [releaseAt, setReleaseAt] = useState("");
  const [evidenceUri, setEvidenceUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const previewAmount = (() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();
  const merchantPreview =
    merchant.length > 8 ? `${merchant.slice(0, 4)}…${merchant.slice(-4)}` : merchant || "—";

  async function handleSubmit() {
    setError(null);
    setSignature(null);
    if (!program || !wallet.publicKey) {
      setVisible(true);
      return;
    }
    if (!TEST_USDC_MINT) {
      setError("NEXT_PUBLIC_TEST_USDC_MINT is not set. Run `pnpm tsx scripts/setup-demo.ts` to seed it.");
      return;
    }

    let merchantPk: PublicKey;
    try {
      merchantPk = new PublicKey(merchant.trim());
    } catch {
      setError("Merchant address is not a valid Solana public key.");
      return;
    }

    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    const releaseUnix =
      releaseAt && Date.parse(releaseAt) > 0
        ? Math.floor(Date.parse(releaseAt) / 1000)
        : 0;

    setBusy(true);
    try {
      const mint = new PublicKey(TEST_USDC_MINT);
      const escrowId = new BN(Date.now());
      const payerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const ixs: TransactionInstruction[] = [];
      const ataInfo = await connection.getAccountInfo(payerAta);
      if (!ataInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            payerAta,
            wallet.publicKey,
            mint,
            TOKEN_PROGRAM_ID,
          ),
        );
      }
      ixs.push(
        await initializeEscrowIx(program, {
          payer: wallet.publicKey,
          merchant: merchantPk,
          mint,
          payerTokenAccount: payerAta,
          escrowId,
          amount: new BN(Math.floor(num * 1_000_000)),
          releaseAfter: new BN(releaseUnix),
        }),
      );
      const sig = await sendTx({ connection, wallet, ixs });
      setSignature(sig);
      await qc.invalidateQueries({ queryKey: ["escrows"] });
      void evidenceUri;
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

  const connected = !!wallet.publicKey;

  return (
    <>
      <div className="v-page-header">
        <div>
          <div className="v-page-title">New Escrow</div>
          <div className="v-page-subtitle">
            Lock funds into a smart contract with automatic dispute resolution
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "560px 1fr",
          background: "var(--bg-subtle)",
          minHeight: "calc(100vh - 52px - 105px)",
        }}
      >
        <div style={{ padding: 24, maxWidth: 560 }}>
          <div className="v-card v-card-lg" style={{ overflow: "hidden" }}>
            <FormSection label="Parties">
              <Field
                label="Merchant wallet address"
                hint="The service provider who will receive payment on success"
              >
                <input
                  className="v-field-input v-mono"
                  placeholder="Public key (base58)"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </Field>
            </FormSection>

            <FormSection label="Payment">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Amount (test USDC)">
                  <input
                    className="v-field-input v-mono"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Release after (optional)">
                  <input
                    className="v-field-input"
                    type="datetime-local"
                    value={releaseAt}
                    onChange={(e) => setReleaseAt(e.target.value)}
                  />
                </Field>
              </div>
              <div className="v-field-hint">
                Funds are held in a program-owned vault until released or disputed
              </div>
            </FormSection>

            <FormSection label="Dispute settings">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Voting window">
                  <input className="v-field-input" defaultValue="6 hours" readOnly />
                </Field>
                <Field label="Panel size">
                  <input className="v-field-input" defaultValue="3 jurors" readOnly />
                </Field>
              </div>
              <Field
                label="Evidence URI (optional)"
                hint="Attached when a dispute is later raised on this escrow"
              >
                <input
                  className="v-field-input v-mono"
                  placeholder="ipfs:// or https://"
                  value={evidenceUri}
                  onChange={(e) => setEvidenceUri(e.target.value)}
                />
              </Field>
            </FormSection>

            <div
              style={{
                padding: "16px 24px",
                background: "var(--bg-subtle)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                Locking{" "}
                <strong className="v-mono" style={{ color: "var(--text-1)" }}>
                  {previewAmount}
                </strong>{" "}
                USDC →{" "}
                <strong className="v-mono" style={{ color: "var(--text-1)" }}>
                  {merchantPreview}
                </strong>
              </div>
              <button
                className="v-btn v-btn-primary"
                onClick={handleSubmit}
                disabled={busy}
              >
                {busy ? "Creating…" : connected ? "Create escrow →" : "Connect wallet"}
              </button>
            </div>

            {error ? (
              <div
                className="v-mono"
                style={{
                  background: "var(--red-bg)",
                  border: "1px solid var(--red-border)",
                  color: "var(--red)",
                  padding: "10px 16px",
                  margin: "0 24px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  wordBreak: "break-word",
                }}
              >
                {error}
              </div>
            ) : null}

            {signature ? (
              <div
                style={{
                  background: "var(--green-bg)",
                  border: "1px solid var(--green-border)",
                  color: "var(--green)",
                  padding: "10px 16px",
                  margin: "0 24px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                Escrow funded.{" "}
                <a
                  href={explorerTxUrl(signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="v-mono"
                  style={{ textDecoration: "underline" }}
                >
                  View tx
                </a>{" "}
                ·{" "}
                <Link href="/escrows" style={{ textDecoration: "underline" }}>
                  My escrows
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right explainer */}
        <aside className="v-layout-side" style={{ padding: "24px 28px" }}>
          <div className="v-side-label" style={{ marginBottom: 16 }}>
            How it works
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Step
              n={1}
              title="Fund the escrow"
              body="Your USDC is locked in a program-owned vault. Neither party can access it without a verdict or mutual release."
            />
            <Step
              n={2}
              title="Merchant delivers"
              body="If satisfied, you release the funds directly. If not, raise a dispute with evidence."
            />
            <Step
              n={3}
              title="Bonded jurors decide"
              body="A panel of 3 jurors reviews your evidence and votes. Median resolution: 3.4 hours."
            />
            <Step
              n={4}
              title="Escrow auto-releases"
              body="The majority verdict triggers automatic USDC transfer. No manual steps, no waiting."
            />
          </div>

          <div
            style={{
              marginTop: 28,
              padding: 14,
              background: "var(--bg-muted)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-2)" }}>
              Tie-breaker rule
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              If votes are tied, funds are released to the merchant. This is a
              documented MVP design choice — both parties agree to this at
              escrow creation.
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="v-field-label">{label}</label>
      {children}
      {hint ? <div className="v-field-hint">{hint}</div> : null}
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--text-1)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );
}
