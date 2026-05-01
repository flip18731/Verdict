"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

// WalletMultiButton uses window/localStorage on first paint; load client-only.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/escrows/new", label: "New escrow" },
  { href: "/escrows", label: "My escrows" },
  { href: "/disputes", label: "Disputes" },
  { href: "/jurors/me", label: "Juror" },
];

export function Header() {
  return (
    <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Verdict
          <span className="ml-2 align-middle text-xs uppercase tracking-[0.2em] text-gold-600">
            beta
          </span>
        </Link>
        <nav className="hidden gap-6 text-sm text-indigo-800 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-gold-600">
              {n.label}
            </Link>
          ))}
        </nav>
        <WalletMultiButton />
      </div>
    </header>
  );
}
