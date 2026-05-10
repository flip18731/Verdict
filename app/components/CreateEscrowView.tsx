"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

type Step = 1 | 2 | 3 | 4;

export default function CreateEscrowView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();
  const qc = useQueryClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [votingWindowHours, setVotingWindowHours] = useState("6");
  const [evidenceUri, setEvidenceUri] = useState("");
  // Kept in state for future expansion / parity with the on-chain ix shape;
  // the wizard does not expose a release-after input so this defaults to 0.
  const [releaseAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  // ── Step validation ─────────────────────────────────────────────
  const merchantTrimmed = merchant.trim();
  const merchantTouched = merchantTrimmed.length > 0;
  const merchantValid = (() => {
    if (merchantTrimmed.length < 32 || merchantTrimmed.length > 44) return false;
    try {
      new PublicKey(merchantTrimmed);
      return true;
    } catch {
      return false;
    }
  })();
  const merchantError = merchantTouched && !merchantValid
    ? "Invalid Solana wallet address."
    : null;
  const amountNum = parseFloat(amount);
  const amountTouched = amount.length > 0;
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const amountError = amountTouched && !amountValid
    ? "Amount must be greater than 0."
    : null;

  // ── handleSubmit (unchanged on-chain logic) ─────────────────────
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
      void votingWindowHours;
      setTimeout(() => router.push("/escrows"), 2000);
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
  const merchantPreview = merchantValid
    ? `${merchant.trim().slice(0, 4)}…${merchant.trim().slice(-4)}`
    : merchant.trim() || "—";
  const amountPreview = amountValid
    ? amountNum.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

  return (
    <div className="wizard-wrap">
      <div className="v-card" style={{ padding: 32 }}>
        <div className="wizard-dots">
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <div
              key={n}
              className={`wizard-dot${step === n ? " active" : ""}`}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="wizard-step" key="step-1">
            <div className="wizard-title">Who are you paying?</div>
            <div className="wizard-hint">
              Verdict locks your USDC in a program-controlled vault until you release
              it or a juror panel rules. Start by telling us who the merchant is.
            </div>
            <label className="v-field-label">Merchant wallet address</label>
            <input
              className={`v-field-input v-mono${merchantError ? " error" : ""}`}
              placeholder="Public key (base58)"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              autoFocus
            />
            {merchantError ? (
              <div className="field-error">{merchantError}</div>
            ) : (
              <div className="v-field-hint">
                The service provider who will receive payment if you release the escrow.
              </div>
            )}
            <div className="wizard-actions">
              <span />
              <button
                className="v-btn v-btn-primary"
                disabled={!merchantValid}
                onClick={() => setStep(2)}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-step" key="step-2">
            <div className="wizard-title">How much are you locking?</div>
            <div className="wizard-hint">
              The full amount transfers from your token account into a PDA-owned
              vault. It cannot be moved without a release or verdict.
            </div>
            <label className="v-field-label">Amount (test USDC)</label>
            <input
              className={`v-field-input v-mono${amountError ? " error" : ""}`}
              type="number"
              min={1}
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {amountError ? (
              <div className="field-error">{amountError}</div>
            ) : null}
            {amountValid ? (
              <div
                className="v-mono"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: "var(--text-1)",
                  margin: "12px 0 4px",
                  letterSpacing: "-.4px",
                }}
              >
                {amountNum.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>USDC</span>
              </div>
            ) : null}
            <div className="v-field-hint">
              Funds are held in a program-owned vault. Neither party can access
              them without a verdict or release.
            </div>
            <div className="wizard-actions">
              <button className="wizard-back" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="v-btn v-btn-primary"
                disabled={!amountValid}
                onClick={() => setStep(3)}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-step" key="step-3">
            <div className="wizard-title">Dispute settings</div>
            <div className="wizard-hint">
              If something goes wrong, a panel of three on-chain jurors rules within
              the voting window. These defaults are fine for most cases.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label className="v-field-label">Voting window (hours)</label>
                <input
                  className="v-field-input v-mono"
                  type="number"
                  min={1}
                  value={votingWindowHours}
                  onChange={(e) => setVotingWindowHours(e.target.value)}
                />
              </div>
              <div>
                <label className="v-field-label">Panel size</label>
                <input
                  className="v-field-input"
                  defaultValue="3 jurors"
                  readOnly
                />
              </div>
            </div>
            <label className="v-field-label">Evidence URI (optional)</label>
            <input
              className="v-field-input v-mono"
              placeholder="ipfs:// or https://"
              value={evidenceUri}
              onChange={(e) => setEvidenceUri(e.target.value)}
            />
            <div className="v-field-hint">
              You can attach evidence when raising a dispute later — this is optional.
            </div>
            <div className="wizard-actions">
              <button className="wizard-back" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className="v-btn v-btn-primary"
                onClick={() => setStep(4)}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-step" key="step-4">
            <div className="wizard-title">Review your escrow</div>
            <div className="wizard-hint">
              One last look. Once you confirm, the funds move on-chain immediately.
            </div>

            <div style={{ marginBottom: 16 }}>
              <ReviewRow label="Merchant" value={merchantPreview} onEdit={() => setStep(1)} />
              <ReviewRow label="Amount" value={`${amountPreview} USDC`} onEdit={() => setStep(2)} />
              <ReviewRow label="Voting window" value={`${votingWindowHours || "6"} hours`} onEdit={() => setStep(3)} />
              <ReviewRow label="Panel size" value="3 jurors" />
              {evidenceUri ? (
                <ReviewRow
                  label="Evidence"
                  value={
                    evidenceUri.length > 28
                      ? `${evidenceUri.slice(0, 14)}…${evidenceUri.slice(-10)}`
                      : evidenceUri
                  }
                  onEdit={() => setStep(3)}
                />
              ) : null}
            </div>

            {error ? (
              <div
                className="v-mono"
                style={{
                  background: "var(--red-bg)",
                  border: "1px solid var(--red-border)",
                  color: "var(--red)",
                  padding: "10px 12px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  wordBreak: "break-word",
                  marginBottom: 12,
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
                  padding: "12px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 12,
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
                </a>
              </div>
            ) : null}

            <div className="wizard-actions">
              <button
                className="wizard-back"
                onClick={() => setStep(3)}
                disabled={busy}
              >
                ← Back
              </button>
              {signature ? (
                <span className="v-btn v-btn-primary" style={{ opacity: 0.7 }}>
                  Redirecting…
                </span>
              ) : (
                <button
                  className="v-btn v-btn-primary"
                  onClick={handleSubmit}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" />
                      Confirming…
                    </>
                  ) : connected ? (
                    "Create escrow"
                  ) : (
                    "Connect wallet"
                  )}
                </button>
              )}
            </div>

            {!signature ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  marginTop: 12,
                  textAlign: "right",
                }}
              >
                This will open your wallet to confirm the transaction.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="wizard-review-row">
      <span className="wizard-review-label">{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="wizard-review-val">{value}</span>
        {onEdit ? (
          <button
            onClick={onEdit}
            style={{
              background: "none",
              border: "none",
              fontSize: 11.5,
              color: "var(--text-3)",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Edit
          </button>
        ) : null}
      </div>
    </div>
  );
}
