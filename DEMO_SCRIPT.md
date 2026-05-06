# Demo Script — Verdict

60-second video walkthrough. No narration required — on-screen action tells the story.

---

## Shot list

| # | Timestamp | Screen | Action / Caption |
|---|-----------|--------|-----------------|
| 1 | 0:00–0:05 | Terminal | `solana-test-validator --reset` running, slot counter ticking. Caption: **"Local Solana validator. Real on-chain state."** |
| 2 | 0:05–0:10 | Terminal | `pnpm tsx scripts/setup-demo.ts` output — 5 wallets funded, 3 jurors registered, smoke walk passes. Caption: **"5 wallets seeded. 3 jurors registered."** |
| 3 | 0:10–0:14 | Browser / Homepage | Open `localhost:3000`. Show Verdict header, "Preamble" landing page, nav links. Caption: **"Verdict — on-chain arbitration for AI-agent commerce."** |
| 4 | 0:14–0:20 | Browser / New Escrow | Connect **agent** wallet. Navigate to "New escrow". Fill: merchant pubkey (paste merchant.json address), amount `40`, release-after `0`. Click **Open escrow**. Wallet pops approval — approve. Caption: **"Agent locks 40 test USDC in a program-controlled vault."** |
| 5 | 0:20–0:24 | Browser / My Escrows | Navigate to "My escrows". Show the new escrow row with status **Funded**, payer and merchant addresses, vault balance. Caption: **"Funds sit in a PDA vault — neither party controls it."** |
| 6 | 0:24–0:30 | Browser / My Escrows | Click **Raise dispute** on the escrow row. Fill evidence URI (`ipfs://demo-evidence`), voting window `120`. Approve. Row status changes to **Disputed**. Caption: **"Payer raises a dispute with on-chain evidence URI."** |
| 7 | 0:30–0:38 | Browser / Disputes | Switch to **juror-a** wallet. Navigate to "Open disputes". Show dispute card: 0 of 3 voted. Click **Vote: refund**. Approve. Card updates: 1 of 3 voted. Switch to **juror-b**, vote refund (2 of 3). Switch to **juror-c**, vote release (3 of 3, panel full). Caption: **"Three jurors vote. Panel closes at 3/3."** |
| 8 | 0:38–0:44 | Browser / Disputes | Back to agent wallet. Dispute card shows "voting window closed / panel full". Click **Resolve**. Approve. Dispute card disappears (account closed). Caption: **"Anyone calls resolve. Program tallies: 2 refund, 1 release → refund wins."** |
| 9 | 0:44–0:50 | Browser / My Escrows | Navigate to "My escrows" as agent. Escrow row is gone (account closed and rent returned). Show agent token balance in wallet: back to 100 test USDC. Caption: **"Vault emptied, escrow closed, rent returned — atomically."** |
| 10 | 0:50–0:57 | Browser / Juror dossier | Switch to **juror-a** wallet. Navigate to "Juror" page. Click **Claim reward**. Approve. Reputation counter increments to 1. Repeat for juror-b (reputation → 1). Caption: **"Majority jurors claim on-chain reputation. Juror-c (minority) gets nothing."** |
| 11 | 0:57–1:00 | Split: terminal + browser | Terminal shows validator logs. Browser shows Verdict header. Caption: **"7 instructions · 4 account types · 13 typed errors · 15 tests passing."** |

---

## Recording notes

- Use two browser profiles (or separate Chromium instances) so agent and merchant wallets don't clash.
- Import each keypair JSON via wallet → Import → paste raw JSON array.
- The voting window is set to 120 seconds in shot 6. To speed up the demo, set it to `10` and record shots 7-8 quickly, or use the pre-seeded state from `setup-demo.ts` which already resolved a dispute.
- For shot 9, token balances visible in Phantom/Solflare without switching to an explorer tab — makes the "funds returned" moment immediate.
- No audio needed. Captions carry the narrative. Keep transitions under 0.5s.
- Total runtime target: 58–62 seconds.

---

## Fallback: terminal-only demo (if browser wallet auth is slow)

Run the demo script and screen-record the terminal output:

```
pnpm tsx scripts/setup-demo.ts
```

The output walks the complete lifecycle with `✓` checkpoints:
```
  ✓ escrow a1b2c3… funded with 40 test-USDC
  ✓ dispute raised
  ✓ juror-a voted refund
  ✓ juror-b voted refund
  ✓ juror-c voted release
  ✓ dispute resolved (outcome: refund)
  ✓ post-resolve balances — agent: 100.00 USDC, merchant: 60.00 USDC
  ✓ juror-a claimed reward → reputation = 1
  ✓ juror-b claimed reward → reputation = 1
```

This is 100% on-chain — every `✓` is a confirmed Solana transaction against a real validator.
