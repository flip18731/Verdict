"use client";

import { AnchorError } from "@coral-xyz/anchor";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  type Signer,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export class TxError extends Error {
  constructor(
    message: string,
    readonly anchorCode?: string,
    readonly logs?: string[],
  ) {
    super(message);
    this.name = "TxError";
  }
}

export interface SendTxOptions {
  connection: Connection;
  wallet: WalletContextState;
  ixs: TransactionInstruction[];
  signers?: Signer[];
}

/**
 * Build → simulate → send → confirm. Simulation runs first so we can surface
 * Anchor error codes from the validator's structured logs without paying for
 * a real send. Throws TxError with a parsed AnchorError code when available.
 */
export async function sendTx({
  connection,
  wallet,
  ixs,
  signers,
}: SendTxOptions): Promise<string> {
  if (!wallet.publicKey) throw new TxError("wallet not connected");
  if (!wallet.signTransaction) {
    throw new TxError("connected wallet cannot sign transactions");
  }

  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  if (signers && signers.length > 0) tx.partialSign(...signers);

  // Simulate before signing-with-wallet so the user doesn't get prompted on a
  // doomed tx. Simulation already includes fee-payer + signer info.
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    throw makeTxError(sim.value.err, sim.value.logs ?? []);
  }

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

function makeTxError(err: unknown, logs: string[]): TxError {
  // Try Anchor's structured parse first — it gives us a typed error code we
  // can match in the UI. Fall back to the raw err shape if parsing fails.
  const parsed = AnchorError.parse(logs);
  if (parsed) {
    return new TxError(
      parsed.error.errorMessage ?? parsed.error.errorCode.code,
      parsed.error.errorCode.code,
      logs,
    );
  }
  const summary = typeof err === "string" ? err : JSON.stringify(err);
  return new TxError(`transaction simulation failed: ${summary}`, undefined, logs);
}
