import type { Metadata } from "next";
import { Cormorant_Garamond, Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "@/components/providers/Providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});
// Geist is unavailable in next/font/google for Next 14.2.35 — Inter is the
// closest geometric sans substitute and ships in the same loader.
const geist = Inter({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdict — arbitration for AI-agent commerce on Solana",
  description:
    "Verdict is an on-chain dispute resolution layer for autonomous-agent payments. Escrow, evidence, juror panels, and binding outcomes — settled in seconds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${cormorant.variable} ${mono.variable} ${geist.variable}`}
    >
      <body>
        <Providers>
          <div className="v-atmos" aria-hidden />
          <div className="v-noise" aria-hidden />
          {children}
        </Providers>
      </body>
    </html>
  );
}
