import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "@/components/providers/Providers";
import { Header } from "@/components/Header";
import { NetworkBanner } from "@/components/NetworkBanner";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const geistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdict — arbitration for AI-agent commerce on Solana",
  description:
    "Verdict is an on-chain dispute resolution layer for autonomous-agent payments. Escrow, evidence, juror panels, and binding outcomes — settled in seconds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-cream-50 text-indigo-900 antialiased">
        <Providers>
          <NetworkBanner />
          <Header />
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
