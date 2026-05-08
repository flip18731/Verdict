# Pitch Q&A — Verdict

Honest answers to fifteen skeptical Colosseum-judge questions. Where an answer reveals a real gap, that gap is also called out in `README.md → KNOWN_GAPS` so a reviewer can see we know our limitations.

---

## Technical

**1. "Your Anchor program has no slashing instruction. You mention bonds in the README. Where is the bond?"**

You're right — the MVP has no on-chain bond. The mockup's "STAKE 50 USDC EACH" line is a UI-level promise the program does not yet enforce. There is no `Bond` account, no `stake_bond` instruction, no `slash_bond` instruction. A bonded juror system is a one-evening additive: a `bond` field on `Juror`, a `stake_bond` ix that escrows USDC into a PDA-owned vault, and a slashing branch in `claim_juror_reward` that, on minority votes, transfers the bond to the dispute winner instead of returning it. The state machine doesn't change. We did not implement it because the MVP scope froze before voting incentives.

**2. "What other missing-mut-class bugs might still exist?"**

The cast_vote `mut` fix was caught by Phase 3 Batch 5 — a test that asserted `juror.cases_voted == 1` after voting. The test suite has 15 tests covering: 3 happy paths, 3 dispute outcomes (refund / release / tie), 7 negatives (unauthorized callers, double-vote, double-dispute, panel-full, voting-not-ended, etc.), reputation accrual, full-lifecycle math invariant. Untested states in the explicit state machine: (a) `register_juror` called on a juror PDA that already exists — relies on `init` discriminator collision but no negative test asserts the failure mode; (b) `release_escrow` called on a `Disputed` escrow — relies on the constraint but no explicit negative test; (c) the `Refunded` terminal state after dispute — only verified via the math-invariant test, not directly. Three known coverage gaps; everything else has a positive or negative case.

**3. "Validator down between dispute and votes / vote tx fails at confirmation / resolve_dispute token transfer fails — recoverable?"**

(a) **Validator down**: dispute PDA is persisted with `status=Open` and `votes_for_*=0`. When the validator restarts, jurors resume voting. Recoverable. (b) **Vote tx fails**: the Vote PDA is created via `init`, so a failure-at-confirmation either creates it cleanly (rare race) or rolls back the entire instruction including the `dispute.jurors_voted += 1` increment. Recoverable. (c) **Resolve token transfer fails**: the order in `resolve_dispute_handler` is `transfer → close_account → state mutation`. Anchor wraps the whole instruction in a transaction; any CPI failure reverts everything including `dispute.status = Resolved`. The dispute stays `Open` and resolve can be retried. Verified by reading `instructions/resolve_dispute.rs:101-131`. Recoverable.

**4. "What stops a payer filing a dispute with `evidence_uri = 'fake'`?"**

Nothing on-chain. The program treats the URI as opaque bytes capped at 256 chars. We made this an explicit design choice in `KNOWN_GAPS` because verifying content on-chain requires either (a) IPFS CID pinning checks via an oracle or (b) Arweave proof-of-access — both are separate primitives. The MVP punt: jurors are responsible for evaluating evidence quality. Production would require either the URI to be a content-addressable hash whose pinning is verified by an oracle, or a hash-commit + reveal pattern.

**5. "How does a judge replicate your environment? Is the setup script tested on a clean machine?"**

The toolchain pinning is in `TOOLCHAIN.md`: Agave 2.3.13 + Anchor 0.31.1 + a manually swapped platform-tools v1.54 in `~/.cache/solana/v1.48/platform-tools/`. The swap is automated in `pnpm setup-toolchain` (idempotent). README has step-by-step bring-up: install rustup → install pnpm → install Agave + add to PATH → install Anchor via avm → `pnpm install` → `pnpm setup-toolchain` → `solana-keygen new` → start validator → `anchor deploy` → `pnpm tsx scripts/setup-demo.ts`. The script has been re-run ≥10 times in this audit; it is not currently CI-tested on a fresh container — that gap is in `KNOWN_GAPS`.

---

## Product

**6. "Who is the first user of Verdict?"**

Honest answer: we don't have a named first integration partner. The plausible target is an x402 micropayments-rail integrator like Stripe Agent Toolkit + a research-data MCP (e.g. Helios, Olas, Brave Search MCP) where x402 payments already flow today. We have not had that conversation. This is a hackathon submission, not a launched protocol — we'd treat distribution as a post-prize problem.

**7. "$25K/day market × 1% take = $250/day. Why build this?"**

Because the take rate isn't where Verdict captures value at maturity. The thesis is that *any* binding agent-to-agent commerce eventually requires a dispute layer; whoever provides the standard captures network effects on the protocol layer (think: how Lightning captures little fee revenue but is irreplaceable infrastructure). At today's $25K/day we'd lose money. At the projected $1B/day in 24-36 months (which we do not control), the same protocol is meaningful. The bet is on the inflection, not on the current TAM. If the inflection doesn't happen, this was a hackathon project.

**8. "What does Verdict do that Kleros, Aragon Court, UMA OO don't — without saying 'Solana' or 'fast'?"**

Verdict couples the dispute oracle to the escrow account at the program level: `resolve_dispute` tallies votes and moves SPL tokens in one atomic instruction. Kleros / Aragon / UMA all return a verdict that *another* contract or off-chain process must enforce — they're decision oracles, not settlement layers. For agent-to-agent commerce where a vendor agent is being paid for a service it just delivered (or didn't), the gap between "verdict rendered" and "funds moved" is exactly the gap that humans currently fill with chargebacks. Verdict closes it.

**9. "3 jurors × $50 stake on a $250K dispute is economically irrational."**

True. The MVP enforces a fixed `PANEL_SIZE = 3`; the constant lives at `state.rs:3`. A production version needs panel size proportional to dispute value (e.g. log-scaled: 3 jurors below $5K, 7 below $50K, 21 above), with stake also scaled. The state machine doesn't change — only `cast_vote` panel-full check and `resolve_dispute` quorum logic shift. This is on the `KNOWN_GAPS` list under "Risk-scaled panel sizing".

**10. "No appeal mechanism. Wrong verdict. What's the recovery path?"**

There isn't one. Once `resolve_dispute` runs, the escrow is closed and tokens are transferred. The losing party has no recourse. This is intentional MVP scope (matches Kleros's "judgment is final unless appealed" but without the appeal court) and listed in `KNOWN_GAPS`. A real network would need a higher-stakes second panel (5-7 jurors with larger bonds) that can override the first verdict within a window before settlement, with appellant putting up the appeal cost and forfeiting it on a confirmed first-panel ruling. State machine impact: a new `Appealed` status between `Open` and `Resolved`, an `AppealPanel` PDA, larger transfer logic in `resolve_dispute`. Not trivial; not in this submission.

---

## Design

**11. "Open the frontend. Tell me in 5 seconds what this product does."**

In the previous build, the homepage was the disputes table — landing on "Active Disputes" without context fails the 5-second test for a brand-new visitor. As of this audit, `/` now leads with a one-sentence positioning ("Dispute resolution for agentic commerce") + three stat cards + two clear primary actions (View active cases / Open an escrow). A user who lands cold should be able to read the H1 and understand the product in well under 5 seconds. The disputes table moved to `/disputes`.

**12. "Connect a real wallet with no escrows / disputes. What do I see?"**

In the previous build, you saw the same hardcoded demo data regardless of connection state — that was technically a UI lie. As of this audit, every list page (`/disputes`, `/escrows`, `/jurors/me`) shows a real empty-state component when wallet is connected and the on-chain query returns zero rows. The empty state explains what to do next ("No open disputes assigned to your panel — register as a juror to start receiving cases"). When wallet is disconnected, list pages show a "Connect wallet" affordance, not fake data.

**13. "Gold = disputed, pending action, AND decoration in the logo. Pick one."**

Audited: in the current globals.css gold is used for (a) `Disputed` status badge, (b) `Awaiting your vote` page-header badge, (c) verdict-announcement banner, (d) Refund vote button accent, (e) tier-progress fill, (f) sidebar tier badge. Categories (a)–(d) are all "attention required / pending decision" — semantically consistent. (e) and (f) are juror-tier indicators which use gold as the *value* color, not decoration. **The logo is black, not gold.** No decorative use of gold in chrome. The semantic is consistent: gold = something needs your attention or a juror is in the gold tier.

**14. "Where is the confirmation step before an irreversible on-chain vote?"**

Previously absent. As of this audit, the vote button click opens a confirmation modal that explains exactly what the on-chain consequence is ("This will permanently record your vote on Solana mainnet — your decision cannot be changed.") with a primary "Confirm vote" and a ghost "Cancel". The modal also shows the *amount* and the *recipient* if the verdict goes the user's way, so the consequence is concrete, not abstract.

---

## Business

**15. "Revenue model? README says MIT. How does the team capture value?"**

Honest answer: there isn't one yet. The protocol is MIT-licensed because the dispute-resolution primitive is meant to be a public good (analogous to Uniswap-v1: open contract, no fee switch). A team-level revenue path would be: (a) a hosted juror-recruitment service that pre-vets and stakes professional jurors and earns a % of their reputation rewards; (b) an enterprise-tier integration tool that bundles Verdict with KYC/dispute-intake forms; (c) a hosted evidence-storage layer (IPFS pinning + content verification). None of those are built. For the hackathon: we are not optimizing for capture. The submission proves the primitive works; capture is a Series-Seed conversation, not a Phase-7 conversation.
