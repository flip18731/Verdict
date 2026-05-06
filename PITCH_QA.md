# Pitch Q&A — Verdict

Honest answers to the ten questions a skeptical Colosseum judge is most likely to ask.

---

**1. "AI agents don't actually spend money on each other yet. Why build this now?"**

The infrastructure question and the adoption question are separate. TCP/IP existed before the web. Verdict is the settlement layer — it is cheap to build now, impossible to retrofit later. The first agentic payment rails (Stripe Agent Toolkit, OpenAI function-calling with wallets, Solana Agent Kit) shipped in late 2024. Contested payments are already happening manually; Verdict puts binding arbitration on-chain before that manual process calcifies into a bad standard.

---

**2. "Three random jurors is not a credible court. A botnet can register 3 jurors and own every dispute."**

Correct for the MVP — and documented as such in Known Limitations. The on-chain program enforces *that* three unique jurors voted; the MVP leaves *which* jurors are selected to the off-chain layer. The path to production is VRF-backed juror selection on-chain, staked jurors with slashable bonds, and a reputation-weighted vote. All three are tractable follow-ons. The MVP proves the atomic settlement logic, the PDA accounting, and the escrow/dispute state machine — the hard parts.

---

**3. "Evidence is just a URI. Anyone can put garbage in that field."**

True. On-chain content verification requires IPFS CID pinning checks or an oracle, which is a separate primitive. The program caps the URI at 256 bytes and treats it as opaque. For the MVP this is fine: the URI gives jurors *something to look at*, which is the goal. Production would verify a CID against a pinning service or use Arweave's proof-of-access. The design deliberately doesn't paint that into a corner — the field is a generic URI, not a hash commitment.

---

**4. "Your tie-breaker defaults to release (merchant wins). That's merchant-friendly and unfair to payers."**

Documented design choice, not an oversight. Two arguments: (a) in commerce, non-delivery disputes are more common than fraud-by-merchant disputes, so a refund default would be gamed more easily; (b) defaulting to release is analogous to "burden of proof on the accuser." Either direction is defensible. A production version would expose this as a per-escrow parameter set at escrow creation time.

---

**5. "What stops a payer from raising a dispute on every single payment to avoid paying?"**

Nothing in the MVP — and that's an explicit known limitation, not a surprise. Mitigations in a production system: (a) dispute fee paid by the payer at `raise_dispute` time, held until the ruling and forfeited if the payer loses; (b) payer reputation score penalizing frivolous disputes; (c) time-lock on disputes relative to escrow creation. All are additive to the existing state machine.

---

**6. "Your tests pass against a local validator with pre-seeded state. Have you tested failure paths?"**

Yes. The 15-test suite explicitly covers: wrong payer tries to release (error), wrong payer tries to raise dispute (error), unregistered juror tries to cast vote (error), juror votes twice (error), resolve before voting window closes with unfull panel (error), claim reward with wrong vote outcome (error). These are the 7 negative tests listed in the coverage table. The test file is `anchor/tests/verdict.ts`.

---

**7. "The toolchain setup looks complicated. Why Agave 2.3.13 + platform-tools swap? That's a red flag."**

It is complicated, but it's a solved problem documented in `TOOLCHAIN.md`. The root cause is that Anchor 0.30/0.31 dependencies adopted `edition = "2024"` in their Cargo manifests, and Agave 2.3.13's bundled cargo (1.84) predates that stabilization. The fix is one tarball swap (`pnpm setup-toolchain`), idempotent, and project-local. It does not affect other Solana projects on the machine. Once Anza ships Agave 2.4+ with a newer platform-tools bundle, the swap becomes unnecessary. This is a 2026 toolchain reality, not a design flaw.

---

**8. "The juror reputation is just a counter. That's not a credible incentive system."**

For an MVP with test tokens, a counter is exactly the right scope. The important design decisions are already made: reputation is on-chain (not off-chain, not a database), accrual is pull-based (juror claims it themselves, avoiding compute-budget blowup from push on large panels), and it's stored in a dedicated PDA per juror. The counter is the seed of a staking/weighting system — the shape is already correct, only the numeric logic needs extending.

---

**9. "Why not just use SPL Governance or an existing on-chain voting system?"**

SPL Governance is for DAO governance — long time horizons, token-weighted votes, proposal queues. Verdict optimizes for seconds, not days. The dispute lifecycle (open → vote → resolve) needs to be atomic with the token transfer — you can't bolt a governance vote onto an arbitrary escrow without coupling them. The custom Anchor program gives us that tight coupling: `resolve_dispute` tallies votes and moves tokens in one instruction. Using a generic governance framework would require a cross-program oracle and lose the atomic settlement guarantee.

---

**10. "This is a hackathon project. What would it take to make it production-ready?"**

Honest list: (1) VRF-backed juror selection with staked bonds and slashable accounts; (2) dispute fee at raise-time to deter frivolous disputes; (3) per-escrow tie-breaker parameter; (4) IPFS/Arweave CID verification for evidence; (5) appeal mechanism (higher-stakes second panel); (6) mainnet deployment with audited program. None of these require changes to the existing account structure — the PDA layout and instruction signatures remain stable. The MVP is production-shaped, not prototype-shaped.
