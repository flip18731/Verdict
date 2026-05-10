import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export const shortAddr = (pk: string | PublicKey): string => {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  if (s.length <= 9) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export const formatUsdc = (
  raw: bigint | number | BN,
  decimals = 6,
): string => {
  let n: number;
  if (typeof raw === "bigint") n = Number(raw);
  else if (typeof raw === "number") n = raw;
  else n = Number(raw.toString());
  return (n / 10 ** decimals).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const timeAgo = (unixTs: number): string => {
  const diff = Math.floor(Date.now() / 1000 - unixTs);
  if (diff < 0) return "in the future";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const countdown = (secondsLeft: number): string => {
  const s = Math.max(0, Math.floor(secondsLeft));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};
