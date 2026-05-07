"use client";

import { FormEvent, useState } from "react";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  findEscrowPda,
  findVaultPda,
  initializeEscrowIx,
} from "@/lib/verdict-sdk";
import { useVerdictProgram } from "@/lib/useVerdictProgram";
import { sendTx, TxError } from "@/lib/sendTx";
import { TEST_USDC_MINT, explorerAccountUrl, explorerTxUrl } from "@/lib/config";

interface ResultRow {
  signature: string;
  escrow: PublicKey;
  vault: PublicKey;
}

export default function NewEscrowPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useVerdictProgram();
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("10");
  const [releaseAfter, setReleaseAfter] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultRow | null>(null);

  const ready = !!program && !!wallet.publicKey && !!TEST_USDC_MINT;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!program || !wallet.publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (!TEST_USDC_MINT) {
      setError("NEXT_PUBLIC_TEST_USDC_MINT is not set. Run `pnpm tsx scripts/setup-demo.ts`.");
      return;
    }
    let merchantKey: PublicKey;
    try {
      merchantKey = new PublicKey(merchant.trim());
    } catch {
      setError("Merchant must be a valid base58 pubkey.");
      return;
    }
    const mint = new PublicKey(TEST_USDC_MINT);
    const amountUi = Number(amount);
    if (!Number.isFinite(amountUi) || amountUi <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    const releaseAfterSecs = Number(releaseAfter);
    if (!Number.isFinite(releaseAfterSecs)) {
      setError("Release-after must be a number of unix seconds (use 0 for none).");
      return;
    }

    setBusy(true);
    try {
      const escrowId = new BN(Date.now());
      const [escrowPda] = findEscrowPda(program.programId, wallet.publicKey, escrowId);
      const [vaultPda] = findVaultPda(program.programId, escrowPda);

      // Auto-create the payer's ATA if missing — common on a fresh demo wallet.
      const payerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const ataInfo = await connection.getAccountInfo(payerAta);
      const ixs = [];
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
          merchant: merchantKey,
          mint,
          payerTokenAccount: payerAta,
          escrowId,
          amount: new BN(amountUi * 10 ** 6),
          releaseAfter: new BN(releaseAfterSecs),
        }),
      );

      const sig = await sendTx({ connection, wallet, ixs });
      setResult({ signature: sig, escrow: escrowPda, vault: vaultPda });
    } catch (err) {
      if (err instanceof TxError) {
        setError(err.anchorCode ? `${err.anchorCode}: ${err.message}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Article I</p>
        <h1 className="font-serif text-4xl">Open an escrow</h1>
        <p className="text-sm text-indigo-800/85">
          Funds move from your token account into a program-controlled vault. The
          merchant can be paid only after you sign release, or after a juror
          panel rules in their favor.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="grid gap-4 border border-cream-200 bg-white/60 p-6 shadow-sm"
      >
        <Field label="Merchant pubkey">
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. 9xQe…"
            className="w-full rounded border border-cream-200 bg-white px-3 py-2 font-mono text-sm"
          />
        </Field>
        <Field label="Amount (test USDC)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded border border-cream-200 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Release-after (unix seconds; 0 to skip)">
          <input
            value={releaseAfter}
            onChange={(e) => setReleaseAfter(e.target.value)}
            inputMode="numeric"
            className="w-full rounded border border-cream-200 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          disabled={!ready || busy}
          className="mt-2 self-start rounded bg-indigo-900 px-5 py-2 text-sm font-medium text-cream-50 hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : "Open escrow"}
        </button>
        {!wallet.publicKey && (
          <p className="text-xs text-indigo-800/80">Connect a wallet to enable submit.</p>
        )}
        {!TEST_USDC_MINT && (
          <p className="text-xs text-rose-700">
            Set <span className="font-mono">NEXT_PUBLIC_TEST_USDC_MINT</span> in app/.env.local.
          </p>
        )}
      </form>

      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <strong className="font-medium">Failed:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Escrow opened.</p>
          <ResultLine label="Escrow PDA" value={result.escrow.toBase58()} href={explorerAccountUrl(result.escrow.toBase58())} />
          <ResultLine label="Vault" value={result.vault.toBase58()} href={explorerAccountUrl(result.vault.toBase58())} />
          <ResultLine label="Signature" value={result.signature} href={explorerTxUrl(result.signature)} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs uppercase tracking-wider text-indigo-800/80">{label}</span>
      {children}
    </label>
  );
}

function ResultLine({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 break-all">
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
      <a className="font-mono text-xs underline" href={href} target="_blank" rel="noreferrer">
        {value}
      </a>
    </div>
  );
}

// Suppress static-prerender — this page only makes sense client-side with a wallet.
export const dynamic = "force-dynamic";
