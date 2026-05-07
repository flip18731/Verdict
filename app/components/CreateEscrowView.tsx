"use client";

import { useState } from "react";

export default function CreateEscrowView() {
  const [merchant, setMerchant] = useState("Bq4T9wLkMn7R3kPx2xKpT4wRqHelios");
  const [amount, setAmount] = useState("2500");
  const [releaseAt, setReleaseAt] = useState("2026-05-15T12:00");
  const [votingWindow] = useState("6 hours");
  const [evidenceUri, setEvidenceUri] = useState("");

  const previewAmount = (() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();
  const merchantPreview =
    merchant.length > 8 ? `${merchant.slice(0, 4)}…${merchant.slice(-4)}` : merchant;

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
                  placeholder="Public key or .sol domain"
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
                  <label className="field-label">Amount (USDC)</label>
                  <input
                    className="field-input mono-input"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Release after</label>
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
                  <input className="field-input" defaultValue={votingWindow} />
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
                  Attach a document or link describing the service agreement
                </div>
              </div>
            </div>

            <div className="form-footer">
              <div className="form-preview">
                Locking <strong>{previewAmount}</strong> USDC →{" "}
                <strong>{merchantPreview}</strong>
              </div>
              <button className="btn btn-primary">Create escrow →</button>
            </div>
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
              If votes are tied, funds are released to the merchant. This is a documented
              MVP design choice — both parties agree to this at escrow creation.
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
