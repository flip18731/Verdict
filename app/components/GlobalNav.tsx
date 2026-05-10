"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/format";

const LINKS = [
  { href: "/disputes", label: "Disputes" },
  { href: "/escrows", label: "Escrows" },
  { href: "/escrows/new", label: "New Escrow" },
  { href: "/jurors/me", label: "My Profile" },
];

export function GlobalNav() {
  const pathname = usePathname();
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  // /escrows/new vs /escrows: keep them disambiguated so only the most-specific
  // match is highlighted.
  const isActive = (href: string): boolean => {
    if (!pathname) return false;
    if (href === "/escrows" && pathname === "/escrows/new") return false;
    if (href === "/escrows/new") return pathname === "/escrows/new";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const pub = publicKey?.toBase58();
  const label = pub ? shortAddr(pub) : "Connect Wallet";

  return (
    <nav className="v-nav">
      <Link href="/" className="v-nav-logo">
        <div className="v-nav-logo-mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 3L8 13L13 3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        Verdict
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1 }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`v-nav-link${isActive(l.href) ? " active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
        <span className="v-badge v-badge-green">
          <span className="v-badge-dot" />
          Devnet
        </span>
        <button
          className="v-btn v-btn-ghost v-btn-sm"
          onClick={() => {
            if (pub) disconnect().catch(() => undefined);
            else setVisible(true);
          }}
        >
          {label}
        </button>
      </div>
    </nav>
  );
}
