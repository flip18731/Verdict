import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Preamble</p>
        <h1 className="font-serif text-4xl">Verdict</h1>
        <p className="max-w-2xl text-sm text-indigo-800/85">
          On-chain arbitration for AI-agent commerce on Solana. Autonomous agents
          pay each other for services — Verdict holds funds in a program-controlled
          vault, anchors evidence on-chain, and lets a three-juror panel vote in
          seconds. The outcome settles the escrow atomically: refund the payer,
          release to the merchant, or default to release on a tie.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <ArticleCard
          article="I"
          title="Open an escrow"
          body="Fund a vault with test USDC. The merchant is paid only when you release, or when a jury rules for them."
          href="/escrows/new"
          action="Open escrow →"
        />
        <ArticleCard
          article="II"
          title="My escrows"
          body="Every escrow where you are payer or merchant. Release, raise a dispute, or watch for a ruling."
          href="/escrows"
          action="View escrows →"
        />
        <ArticleCard
          article="III"
          title="Open disputes"
          body="Active disputes awaiting juror votes. Three jurors, majority wins, tie defaults to release."
          href="/disputes"
          action="View disputes →"
        />
      </section>

      <section className="border border-cream-200 bg-white/40 p-6">
        <h2 className="font-serif text-xl mb-4">How it works</h2>
        <ol className="space-y-2 text-sm text-indigo-800/85 list-decimal list-inside">
          <li>Payer opens an escrow — funds move from their token account into a PDA vault.</li>
          <li>Payer calls <code className="font-mono text-xs bg-indigo-50 px-1">release_escrow</code> to pay the merchant, or <code className="font-mono text-xs bg-indigo-50 px-1">raise_dispute</code> with evidence.</li>
          <li>Three registered jurors cast votes (refund / release) within the voting window.</li>
          <li>Anyone calls <code className="font-mono text-xs bg-indigo-50 px-1">resolve_dispute</code> — the program tallies votes and pays the winner atomically.</li>
          <li>Majority-aligned jurors call <code className="font-mono text-xs bg-indigo-50 px-1">claim_juror_reward</code> to accrue on-chain reputation.</li>
        </ol>
      </section>

      <p className="text-xs text-indigo-800/50">
        Running on localnet. Connect a wallet (Phantom or Solflare) and import a demo keypair
        from <code className="font-mono">scripts/demo-wallets/</code> to interact.
      </p>
    </div>
  );
}

function ArticleCard({
  article,
  title,
  body,
  href,
  action,
}: {
  article: string;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-cream-200 bg-white/60 p-5 shadow-sm hover:bg-white/80 transition-colors"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-gold-600 mb-1">Article {article}</p>
      <h3 className="font-serif text-lg mb-2">{title}</h3>
      <p className="text-sm text-indigo-800/80 mb-4">{body}</p>
      <span className="text-xs font-medium text-indigo-900 underline">{action}</span>
    </Link>
  );
}

export const dynamic = "force-dynamic";
