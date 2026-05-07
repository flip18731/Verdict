import { type EscrowStatus } from "@/lib/verdict-sdk";

const variantClass: Record<string, string> = {
  funded: "bg-cream-200 text-indigo-900",
  released: "bg-emerald-100 text-emerald-900",
  disputed: "bg-amber-100 text-amber-900",
  refunded: "bg-rose-100 text-rose-900",
};

export function StatusBadge({ status }: { status: EscrowStatus | { open: object } | { resolved: object } }) {
  const key = Object.keys(status)[0] ?? "unknown";
  const cls = variantClass[key] ?? "bg-cream-200 text-indigo-900";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${cls}`}
    >
      {key}
    </span>
  );
}
