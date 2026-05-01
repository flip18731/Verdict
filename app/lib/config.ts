// Single source of truth for env-driven config. Reading these directly off
// process.env in components leads to undefined-checks scattered everywhere;
// centralize here so the failure mode is "config error at startup" rather
// than "silent runtime undefined".

const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (!v) {
    throw new Error(`missing required env var ${key}`);
  }
  return v;
};

export const RPC_URL = required("NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8899");

// Test USDC mint address. Empty string is allowed so the UI can render a
// "configure mint" prompt rather than crashing during prerendering.
export const TEST_USDC_MINT = process.env.NEXT_PUBLIC_TEST_USDC_MINT ?? "";

// Useful for the explorer-link helper. The wallet/provider's connection url
// gets pasted into ?customUrl so localhost demos resolve against the user's
// own validator.
export const EXPLORER_BASE = "https://explorer.solana.com";

export const explorerTxUrl = (sig: string): string =>
  `${EXPLORER_BASE}/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;

export const explorerAccountUrl = (addr: string): string =>
  `${EXPLORER_BASE}/address/${addr}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
