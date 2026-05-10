import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "@/components/providers/Providers";
import { GlobalNav } from "@/components/GlobalNav";
import { ToastProvider } from "@/components/Toast";

// Geist / Geist_Mono are not exported by next/font/google in Next 14.2.35.
// Inter + JetBrains_Mono are the closest shipping substitutes; they keep the
// same --font-geist / --font-mono CSS variable names so every globals.css
// lookup works unchanged.
const geist = Inter({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdict — arbitration for AI-agent commerce on Solana",
  description:
    "Verdict is an on-chain dispute resolution layer for autonomous-agent payments. Escrow, evidence, juror panels, and binding outcomes — settled in seconds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body style={{ paddingTop: "52px" }}>
        <Providers>
          <GlobalNav />
          {children}
          <ToastProvider />
        </Providers>
      </body>
    </html>
  );
}
