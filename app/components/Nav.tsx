"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const LINKS: { href: string; label: string; matches: (p: string) => boolean }[] = [
  {
    href: "/disputes",
    label: "Disputes",
    matches: (p) => p === "/" || p.startsWith("/disputes"),
  },
  {
    href: "/escrows",
    label: "Escrows",
    matches: (p) => p === "/escrows" || p.startsWith("/escrows/"),
  },
  {
    href: "/escrows/new",
    label: "New Escrow",
    matches: (p) => p === "/escrows/new",
  },
  {
    href: "/jurors/me",
    label: "My Profile",
    matches: (p) => p.startsWith("/jurors"),
  },
];

export function Nav() {
  const pathname = usePathname();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const pub = wallet.publicKey?.toBase58();
  const label = pub ? `${pub.slice(0, 4)}…${pub.slice(-4)}` : "Connect Wallet";

  return (
    <nav className="nav">
      <Link href="/disputes" className="nav-logo">
        <div className="nav-logo-mark">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 3 L8 13 L13 3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        Verdict
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => {
          const active = l.matches(pathname);
          // The "Escrows" and "New Escrow" links would both match /escrows/new
          // under the loose Escrows matcher — disambiguate so only one is active.
          const isActive =
            l.href === "/escrows" && pathname === "/escrows/new" ? false : active;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${isActive ? " active" : ""}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <div className="nav-right">
        <span className="badge badge-green">
          <span className="badge-dot" />
          Mainnet
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (pub) wallet.disconnect().catch(() => undefined);
            else setVisible(true);
          }}
        >
          {label}
        </button>
      </div>
    </nav>
  );
}
