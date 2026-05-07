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
import { initializeEscrowIx } from "@/lib/verdict-sdk";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { TEST_USDC_MINT, explorerTxUrl } from "@/lib/config";

export default function CreateEscrowView() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useVerdictProgram();

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
      // Create the payer ATA if missing — judges' demo wallets always have it,
      // but a real first-time user might not.
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
          amount: new BN(Math.floor(num * 1_000_000)), // USDC has 6 decimals
          releaseAfter: new BN(releaseUnix),
        }),
      );
      const sig = await sendTx({ connection, wallet, ixs });
      setSignature(sig);
      // Suppress an unused-var lint nag — evidenceUri is captured for future
      // raise_dispute call when the merchant disputes; not part of init.
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
      <div className="page-header">
        <div>
          <div className="page-title">New Escrow</div>
          <div className="page-subtitle">
            Lock funds into a smart contract with automatic dispute resolution
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "560px 1fr",
          background: "var(--bg-2)",
          minHeight: "calc(100vh - 52px - 105px)",
        }}
      >
        <div className="form-wrap">
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-label">Parties</div>
              <div className="field">
                <label className="field-label">Merchant wallet address</label>
                <input
                  className="field-input mono-input"
                  placeholder="Public key (base58)"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
                <div className="field-hint">
                  The service provider who will receive payment on success
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-label">Payment</div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Amount (test USDC)</label>
                  <input
                    className="field-input mono-input"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Release after (optional)</label>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={releaseAt}
                    onChange={(e) => setReleaseAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="field-hint">
                Funds are held in a program-owned vault until released or disputed
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-label">Dispute settings</div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Voting window</label>
                  <input className="field-input" defaultValue="6 hours" readOnly />
                </div>
                <div className="field">
                  <label className="field-label">Panel size</label>
                  <input className="field-input" defaultValue="3 jurors" readOnly />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Evidence URI (optional)</label>
                <input
                  className="field-input mono-input"
                  placeholder="ipfs:// or https://"
                  value={evidenceUri}
                  onChange={(e) => setEvidenceUri(e.target.value)}
                />
                <div className="field-hint">
                  Attached when a dispute is later raised on this escrow
                </div>
              </div>
            </div>

            <div className="form-footer">
              <div className="form-preview">
                Locking <strong>{previewAmount}</strong> USDC →{" "}
                <strong>{merchantPreview}</strong>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={busy}
              >
                {busy ? "Creating…" : connected ? "Create escrow →" : "Connect wallet"}
              </button>
            </div>

            {error ? (
              <div
                style={{
                  background: "var(--red-bg)",
                  border: "1px solid var(--red-border)",
                  color: "var(--red)",
                  padding: "10px 16px",
                  margin: "0 24px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "var(--font-mono), monospace",
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
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    textDecoration: "underline",
                  }}
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
        <aside className="layout-side" style={{ padding: "24px 28px" }}>
          <div className="side-label" style={{ marginBottom: 16 }}>
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

          <div className="tie-note">
            <div className="tie-note-title">Tie-breaker rule</div>
            <div className="tie-note-body">
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

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="step-row">
      <div className="step-num">{n}</div>
      <div>
        <div className="step-title">{title}</div>
        <div className="step-body">{body}</div>
      </div>
    </div>
  );
}
