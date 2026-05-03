# Verdict

> The dispute layer agentic commerce forgot to build.

Verdict is an on-chain arbitration primitive for AI-agent commerce on Solana.
Autonomous agents are about to spend trillions on each other's services and
there is no settled-on-chain answer for what to do when one of them delivers
garbage. Verdict provides the missing layer: payments live in
program-controlled escrow, evidence is anchored on-chain, three-juror panels
vote in seconds, and outcomes settle the escrow atomically — refund, release,
or default to release on a tie. Jurors who vote with the majority earn
reputation, claim-style.

This repository is the hackathon MVP: a complete vertical slice from the
on-chain Anchor program through a typed TypeScript SDK to a Next.js 14
frontend.

---

## Architecture

```
            ┌────────────────────────────────────────────────┐
            │             Verdict program (Anchor)           │
            │                                                │
   payer──▶ initialize_escrow ──┬─▶ Escrow PDA               │
                                │   ([b"escrow", payer, id]) │
                                │                            │
                                └─▶ Vault token account      │
                                    ([b"vault", escrow])     │
                                    PDA-owned, escrow signer │
                                                             │
   payer──▶ release_escrow ─────▶ vault → merchant ATA       │
                                  close vault, close escrow  │
                                                             │
   payer──▶ raise_dispute ──────▶ Dispute PDA                │
                                  ([b"dispute", escrow])     │
                                  status=Open, panel=3       │
                                                             │
   juror──▶ register_juror ─────▶ Juror PDA                  │
                                  ([b"juror", authority])    │
                                                             │
   juror──▶ cast_vote ──────────▶ Vote PDA                   │
                                  ([b"vote", dispute, juror])│
                                                             │
   anyone─▶ resolve_dispute ────▶ tally → Refund / Release   │
                                  vault → payer or merchant  │
                                  close vault                │
                                                             │
   juror──▶ claim_juror_reward ─▶ if vote == outcome:        │
                                    juror.reputation += 1    │
                                  close vote PDA             │
            └────────────────────────────────────────────────┘
```

PDA seeds, instructions, and account fields are documented in
[`anchor/programs/verdict/src/state.rs`](./anchor/programs/verdict/src/state.rs)
and the per-instruction files under
[`anchor/programs/verdict/src/instructions/`](./anchor/programs/verdict/src/instructions/).

---

## Toolchain

The exact stack the project is built and tested against. See
[`TOOLCHAIN.md`](./TOOLCHAIN.md) for the full story of why each version was
chosen — short version, the standard Anchor-0.30 + Solana-1.18 combo no longer
builds against today's crates.io.

| Tool                       | Version                                              |
| -------------------------- | ---------------------------------------------------- |
| `rustc` (host)             | 1.94.1                                               |
| `solana` / `cargo-build-sbf` | Agave **2.3.13** (Anza fork)                       |
| platform-tools (cached)    | **v1.54** (rustc/cargo 1.89) — *manually swapped*    |
| `anchor` / `avm`           | **0.31.1**                                           |
| `@coral-xyz/anchor` (npm)  | 0.31.1                                               |
| `@solana/web3.js`          | 1.95.3                                               |
| `@solana/spl-token`        | 0.4.8                                                |
| Next.js                    | 14.2.35                                              |
| `node` / `pnpm`            | 22.x / 10.33.0                                       |

### One-time prerequisite: platform-tools v1.54 swap

Agave 2.3.13's `cargo-build-sbf` looks up its bundled toolchain in
`~/.cache/solana/v1.48/platform-tools/`. The release ships **platform-tools
v1.48 with cargo 1.84.0**, which predates `edition2024` stabilization
(cargo 1.85). Modern transitive crates (`indexmap >= 2.10`, `block-buffer >=
0.12`, `cmov >= 0.5`, `toml_parser`, `wit-bindgen >= 0.57`, ...) declare
`edition = "2024"` in their manifests, so cargo 1.84 fails at `cargo metadata`
time before any of our code compiles.

Fix is one tarball swap (project-local — does not affect any other Solana
project on the machine):

```bash
pnpm setup-toolchain      # equivalent to scripts/setup-toolchain.sh
```

The script backs up the existing `platform-tools/` directory before replacing
it with v1.54 from `anza-xyz/platform-tools`, and is idempotent (re-running on
an already-swapped install is a no-op).

---

## Bring-up

A teammate cloning fresh should reach a working demo in under ten minutes
with these steps:

```bash
# 0. one-time prerequisites (skip if already installed)
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.13/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.31.1 && avm use 0.31.1

# 1. install workspace deps + swap platform-tools
pnpm install
pnpm setup-toolchain      # one-time per machine

# 2. start a fresh validator (in a dedicated terminal — leave it running)
solana-test-validator --reset

# 3. build + deploy program
cd anchor && anchor build && anchor deploy

# 4. seed demo data (creates test mint, 5 wallets, registers 3 jurors,
#    runs an end-to-end smoke walk, writes app/.env.local)
cd .. && pnpm tsx scripts/setup-demo.ts

# 5. start frontend
cd app && pnpm dev
```

Then open `http://localhost:3000` and import the keypairs printed by step 4
into your wallet — Phantom or Solflare both accept `solana-keygen`-formatted
JSON via "Import private key → Paste JSON array".

The demo script is also wired into Anchor:

```bash
cd anchor && anchor run demo
```

---

## What's tested

| Layer                  | Coverage                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| On-chain (Anchor)      | **15 tests passing** — happy paths × 3, dispute paths × 3, negative cases × 7, reputation accrual, full-lifecycle math invariant |
| Clippy (strict)        | `cargo clippy --release -- -D warnings` clean, 0 warnings        |
| TypeScript SDK         | smoke test runs a full escrow → release against a live validator |
| Next.js frontend       | production build succeeds, all 5 routes prerender, 0 type errors |
| End-to-end demo path   | `scripts/setup-demo.ts` executes the full lifecycle programmatically — escrow funded, dispute raised, 3 votes cast, dispute resolved, 2 jurors claim reputation. Same flow a judge would walk in the UI. |

Detailed instruction list: 7 instructions
(`register_juror`, `initialize_escrow`, `release_escrow`, `raise_dispute`,
`cast_vote`, `resolve_dispute`, `claim_juror_reward`); 4 account types
(`Escrow`, `Dispute`, `Juror`, `Vote`); 13 typed errors.

---

## Known limitations

These are MVP scope, not bugs. Each is solvable; none is a now-problem for the
hackathon submission.

- **Juror panel selection is off-chain.** The on-chain program enforces panel
  size (3) by counting unique `Vote` PDAs; the frontend selects which jurors
  see which dispute. A production version would put VRF-backed selection
  on-chain.
- **Juror reputation is unweighted.** +1 per majority-aligned vote. A real
  network would weight by stake or prior reputation.
- **Tie-breaker (0-0 votes) defaults to Release.** Documented design choice —
  favors merchants when nothing decisive is said. Either direction is
  defensible; the spec picks one.
- **Evidence is URI-only.** No on-chain content verification. The frontend
  rewrites `ipfs://` through a public gateway so links open, but the program
  treats the URI as opaque bytes capped at 256 chars.
- **No appeal mechanism.** A panel verdict is final.
- **Pull-based reputation accrual.** Each juror calls `claim_juror_reward`
  themselves rather than having `resolve_dispute` iterate the panel. This is
  intentional — a push-based design risks compute-budget blowup as panel
  sizes grow. See the doc-comment in `claim_juror_reward.rs`.

---

## Repository layout

```
verdict/
  anchor/                       Anchor workspace (Solana program + tests)
    programs/verdict/src/       lib.rs, errors.rs, state.rs, instructions/*.rs
    tests/verdict.ts            15-test integration suite
    target/{idl,types}/         generated by `anchor build`
  packages/sdk/                 Typed TS client (verdict-sdk)
    src/{program,pdas,instructions,shapes}.ts
    test/smoke.test.ts
  app/                          Next.js 14 frontend (verdict-app)
    app/{,/escrows,/disputes,/jurors/me}/page.tsx
    components/{Header,NetworkBanner,StatusBadge,providers/}.tsx
    lib/{config,sendTx,useVerdictProgram,queries}.ts
  scripts/
    setup-toolchain.sh          one-time platform-tools v1.54 swap
    setup-demo.ts               seed validator + e2e smoke walk
  TOOLCHAIN.md                  full toolchain saga
  README.md                     this file
```

---

## License

MIT.
