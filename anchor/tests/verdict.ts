import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Verdict } from "../target/types/verdict";
import {
  airdrop,
  createEmptyAta,
  expectAnchorError,
  findDisputePda,
  findEscrowPda,
  findJurorPda,
  findVaultPda,
  findVotePda,
  fundWalletWithUsdc,
  setupTestMint,
  TEST_USDC_DECIMALS,
  tokenBalance,
  accountExists,
} from "./helpers";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const usdc = (n: number) => new BN(n * 10 ** TEST_USDC_DECIMALS);

describe("verdict", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.Verdict as Program<Verdict>;

  // Funded once; reused across tests (fresh wallets per test, fresh mint isn't necessary).
  let mintAuthority: Keypair;
  let mint: PublicKey;
  let escrowSeq = 0n;
  const nextEscrowId = () => {
    escrowSeq += 1n;
    return new BN(escrowSeq.toString());
  };

  before(async () => {
    mintAuthority = Keypair.generate();
    await airdrop(provider.connection, mintAuthority.publicKey, 100);
    mint = await setupTestMint(provider, mintAuthority);
  });

  // ---------- Happy paths ----------

  describe("initialize_escrow", () => {
    it("funds the vault with the exact amount and sets state to Funded", async () => {
      const payer = Keypair.generate();
      const merchant = Keypair.generate();
      await airdrop(provider.connection, payer.publicKey);

      const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payer, 100);
      const payerStart = await tokenBalance(provider.connection, payerAta);

      const escrowId = nextEscrowId();
      const [escrowPda] = findEscrowPda(program, payer.publicKey, escrowId);
      const [vaultPda] = findVaultPda(program, escrowPda);
      const amount = usdc(40);

      await program.methods
        .initializeEscrow(escrowId, amount, new BN(0))
        .accounts({
          payer: payer.publicKey,
          merchant: merchant.publicKey,
          mint,
          payerTokenAccount: payerAta,
        } as any)
        .signers([payer])
        .rpc();

      const escrow = await program.account.escrow.fetch(escrowPda);
      expect(escrow.amount.toString()).to.equal(amount.toString());
      expect(escrow.payer.toBase58()).to.equal(payer.publicKey.toBase58());
      expect(escrow.merchant.toBase58()).to.equal(merchant.publicKey.toBase58());
      expect(escrow.mint.toBase58()).to.equal(mint.toBase58());
      expect(escrow.vault.toBase58()).to.equal(vaultPda.toBase58());
      expect(escrow.status).to.deep.equal({ funded: {} });
      expect(escrow.dispute).to.be.null;

      const payerEnd = await tokenBalance(provider.connection, payerAta);
      const vaultEnd = await tokenBalance(provider.connection, vaultPda);
      expect(payerStart - payerEnd).to.equal(BigInt(amount.toString()));
      expect(vaultEnd).to.equal(BigInt(amount.toString()));
    });

    it("rejects amount = 0 with InvalidAmount", async () => {
      const payer = Keypair.generate();
      const merchant = Keypair.generate();
      await airdrop(provider.connection, payer.publicKey);
      const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payer, 10);

      const escrowId = nextEscrowId();
      try {
        await program.methods
          .initializeEscrow(escrowId, new BN(0), new BN(0))
          .accounts({
            payer: payer.publicKey,
            merchant: merchant.publicKey,
            mint,
            payerTokenAccount: payerAta,
          } as any)
          .signers([payer])
          .rpc();
        expect.fail("expected InvalidAmount, got success");
      } catch (err) {
        expectAnchorError(err, "InvalidAmount");
      }
    });
  });

  describe("release_escrow", () => {
    it("transfers vault → merchant, closes vault, refunds rent to payer; token conservation holds", async () => {
      const payer = Keypair.generate();
      const merchant = Keypair.generate();
      await airdrop(provider.connection, payer.publicKey);

      const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payer, 100);
      const merchantAta = await createEmptyAta(provider, mintAuthority, mint, merchant.publicKey);

      const payerInitial = await tokenBalance(provider.connection, payerAta);
      const merchantInitial = await tokenBalance(provider.connection, merchantAta);
      const initialTotal = payerInitial + merchantInitial;
      expect(merchantInitial).to.equal(0n);

      const escrowId = nextEscrowId();
      const [escrowPda] = findEscrowPda(program, payer.publicKey, escrowId);
      const [vaultPda] = findVaultPda(program, escrowPda);
      const amount = usdc(60);

      await program.methods
        .initializeEscrow(escrowId, amount, new BN(0))
        .accounts({
          payer: payer.publicKey,
          merchant: merchant.publicKey,
          mint,
          payerTokenAccount: payerAta,
        } as any)
        .signers([payer])
        .rpc();

      // Conservation after escrow funding: payer + merchant + vault = initial total.
      {
        const payer1 = await tokenBalance(provider.connection, payerAta);
        const merchant1 = await tokenBalance(provider.connection, merchantAta);
        const vault1 = await tokenBalance(provider.connection, vaultPda);
        expect(payer1 + merchant1 + vault1).to.equal(initialTotal);
      }

      await program.methods
        .releaseEscrow()
        .accounts({
          payer: payer.publicKey,
          escrow: escrowPda,
          vault: vaultPda,
          merchantTokenAccount: merchantAta,
        } as any)
        .signers([payer])
        .rpc();

      // Conservation after release: vault closed, payer drained-by-amount, merchant credited.
      const payer2 = await tokenBalance(provider.connection, payerAta);
      const merchant2 = await tokenBalance(provider.connection, merchantAta);
      const vault2 = await tokenBalance(provider.connection, vaultPda);
      expect(vault2).to.equal(0n);
      expect(merchant2).to.equal(BigInt(amount.toString()));
      expect(payer2 + merchant2).to.equal(initialTotal);

      // Vault and Escrow account both closed (rent recovered to payer).
      expect(await accountExists(provider.connection, vaultPda)).to.be.false;
      expect(await accountExists(provider.connection, escrowPda)).to.be.false;
    });
  });

  // ---------- Dispute resolution paths ----------

  // Helper: register a fresh juror keypair, returning the keypair + its PDA.
  async function registerJuror(): Promise<{ kp: Keypair; pda: PublicKey }> {
    const kp = Keypair.generate();
    await airdrop(provider.connection, kp.publicKey, 5);
    const [pda] = findJurorPda(program, kp.publicKey);
    await program.methods
      .registerJuror()
      .accounts({ authority: kp.publicKey } as any)
      .signers([kp])
      .rpc();
    return { kp, pda };
  }

  // Helper: stand up a fully-funded escrow with a dispute open, panel size 3.
  // Returns every PDA + signer the caller might want to drive votes / resolve.
  async function setupDispute(opts: {
    amountUsdc: number;
    votingWindowSeconds: number;
  }): Promise<{
    payer: Keypair;
    payerAta: PublicKey;
    merchant: Keypair;
    merchantAta: PublicKey;
    escrowPda: PublicKey;
    vaultPda: PublicKey;
    disputePda: PublicKey;
    amount: BN;
    initialTotal: bigint;
  }> {
    const payer = Keypair.generate();
    const merchant = Keypair.generate();
    await airdrop(provider.connection, payer.publicKey);
    const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payer, 100);
    const merchantAta = await createEmptyAta(provider, mintAuthority, mint, merchant.publicKey);

    const payerInitial = await tokenBalance(provider.connection, payerAta);
    const merchantInitial = await tokenBalance(provider.connection, merchantAta);
    const initialTotal = payerInitial + merchantInitial;

    const escrowId = nextEscrowId();
    const [escrowPda] = findEscrowPda(program, payer.publicKey, escrowId);
    const [vaultPda] = findVaultPda(program, escrowPda);
    const [disputePda] = findDisputePda(program, escrowPda);
    const amount = usdc(opts.amountUsdc);

    await program.methods
      .initializeEscrow(escrowId, amount, new BN(0))
      .accounts({
        payer: payer.publicKey,
        merchant: merchant.publicKey,
        mint,
        payerTokenAccount: payerAta,
      } as any)
      .signers([payer])
      .rpc();

    await program.methods
      .raiseDispute("ipfs://demo-evidence", new BN(opts.votingWindowSeconds))
      .accounts({
        payer: payer.publicKey,
        escrow: escrowPda,
      } as any)
      .signers([payer])
      .rpc();

    return {
      payer,
      payerAta,
      merchant,
      merchantAta,
      escrowPda,
      vaultPda,
      disputePda,
      amount,
      initialTotal,
    };
  }

  // Helper: drive a vote from juror.kp on the given dispute.
  async function castVote(
    juror: { kp: Keypair; pda: PublicKey },
    dispute: PublicKey,
    choice: "refund" | "release",
  ): Promise<void> {
    await program.methods
      .castVote(choice === "refund" ? { refund: {} } : { release: {} })
      .accounts({
        authority: juror.kp.publicKey,
        dispute,
      } as any)
      .signers([juror.kp])
      .rpc();
  }

  // Helper: resolve the dispute. Caller can be any signer.
  async function resolveDispute(ctx: {
    caller: Keypair;
    payer: PublicKey;
    payerAta: PublicKey;
    merchantAta: PublicKey;
    escrowPda: PublicKey;
    vaultPda: PublicKey;
    disputePda: PublicKey;
  }): Promise<void> {
    await program.methods
      .resolveDispute()
      .accounts({
        caller: ctx.caller.publicKey,
        escrow: ctx.escrowPda,
        dispute: ctx.disputePda,
        vault: ctx.vaultPda,
        payerTokenAccount: ctx.payerAta,
        merchantTokenAccount: ctx.merchantAta,
        payerRentRecipient: ctx.payer,
      } as any)
      .signers([ctx.caller])
      .rpc();
  }

  describe("resolve_dispute", () => {
    it("2 refund + 1 release votes → payer is refunded the full amount", async () => {
      const ctx = await setupDispute({ amountUsdc: 50, votingWindowSeconds: 120 });
      const j1 = await registerJuror();
      const j2 = await registerJuror();
      const j3 = await registerJuror();
      await castVote(j1, ctx.disputePda, "refund");
      await castVote(j2, ctx.disputePda, "refund");
      await castVote(j3, ctx.disputePda, "release");

      await resolveDispute({
        caller: ctx.payer,
        payer: ctx.payer.publicKey,
        payerAta: ctx.payerAta,
        merchantAta: ctx.merchantAta,
        escrowPda: ctx.escrowPda,
        vaultPda: ctx.vaultPda,
        disputePda: ctx.disputePda,
      });

      const payerEnd = await tokenBalance(provider.connection, ctx.payerAta);
      const merchantEnd = await tokenBalance(provider.connection, ctx.merchantAta);
      expect(merchantEnd).to.equal(0n);
      expect(payerEnd).to.equal(ctx.initialTotal);
      expect(await accountExists(provider.connection, ctx.vaultPda)).to.be.false;

      const dispute = await program.account.dispute.fetch(ctx.disputePda);
      expect(dispute.status).to.deep.equal({ resolved: {} });
      expect(dispute.outcome).to.deep.equal({ refund: {} });
    });

    it("1 refund + 2 release votes → merchant gets the full amount", async () => {
      const ctx = await setupDispute({ amountUsdc: 75, votingWindowSeconds: 120 });
      const j1 = await registerJuror();
      const j2 = await registerJuror();
      const j3 = await registerJuror();
      await castVote(j1, ctx.disputePda, "release");
      await castVote(j2, ctx.disputePda, "release");
      await castVote(j3, ctx.disputePda, "refund");

      await resolveDispute({
        caller: ctx.payer,
        payer: ctx.payer.publicKey,
        payerAta: ctx.payerAta,
        merchantAta: ctx.merchantAta,
        escrowPda: ctx.escrowPda,
        vaultPda: ctx.vaultPda,
        disputePda: ctx.disputePda,
      });

      const payerEnd = await tokenBalance(provider.connection, ctx.payerAta);
      const merchantEnd = await tokenBalance(provider.connection, ctx.merchantAta);
      expect(merchantEnd).to.equal(BigInt(ctx.amount.toString()));
      expect(payerEnd + merchantEnd).to.equal(ctx.initialTotal);

      const dispute = await program.account.dispute.fetch(ctx.disputePda);
      expect(dispute.outcome).to.deep.equal({ release: {} });
    });

    it("0-0 votes after window expires → tie-break Release (MVP rule)", async () => {
      const ctx = await setupDispute({ amountUsdc: 30, votingWindowSeconds: 2 });
      // No jurors vote. Wait out the window so resolve() is allowed.
      await sleep(3500);

      await resolveDispute({
        caller: ctx.payer,
        payer: ctx.payer.publicKey,
        payerAta: ctx.payerAta,
        merchantAta: ctx.merchantAta,
        escrowPda: ctx.escrowPda,
        vaultPda: ctx.vaultPda,
        disputePda: ctx.disputePda,
      });

      const merchantEnd = await tokenBalance(provider.connection, ctx.merchantAta);
      expect(merchantEnd).to.equal(BigInt(ctx.amount.toString()));

      const dispute = await program.account.dispute.fetch(ctx.disputePda);
      expect(dispute.outcome).to.deep.equal({ release: {} });
      expect(dispute.votesForRefund).to.equal(0);
      expect(dispute.votesForRelease).to.equal(0);
    });
  });

  // ---------- Negative tests (batch 3: authorization + double-vote) ----------

  describe("negative cases", () => {
    it("non-payer attempts release_escrow → Unauthorized", async () => {
      // Stand up a funded escrow with payerA as the legitimate payer.
      const payerA = Keypair.generate();
      const merchant = Keypair.generate();
      const attacker = Keypair.generate();
      await airdrop(provider.connection, payerA.publicKey);
      await airdrop(provider.connection, attacker.publicKey);
      const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payerA, 50);
      const merchantAta = await createEmptyAta(provider, mintAuthority, mint, merchant.publicKey);

      const escrowId = nextEscrowId();
      const [escrowPda] = findEscrowPda(program, payerA.publicKey, escrowId);
      const [vaultPda] = findVaultPda(program, escrowPda);

      await program.methods
        .initializeEscrow(escrowId, usdc(10), new BN(0))
        .accounts({
          payer: payerA.publicKey,
          merchant: merchant.publicKey,
          mint,
          payerTokenAccount: payerAta,
        } as any)
        .signers([payerA])
        .rpc();

      try {
        await program.methods
          .releaseEscrow()
          .accounts({
            payer: attacker.publicKey, // wrong signer
            escrow: escrowPda,
            vault: vaultPda,
            merchantTokenAccount: merchantAta,
          } as any)
          .signers([attacker])
          .rpc();
        expect.fail("expected Unauthorized");
      } catch (err) {
        // has_one = payer @ Unauthorized
        expectAnchorError(err, "Unauthorized");
      }
    });

    it("non-payer attempts raise_dispute → Unauthorized", async () => {
      const payerA = Keypair.generate();
      const merchant = Keypair.generate();
      const attacker = Keypair.generate();
      await airdrop(provider.connection, payerA.publicKey);
      await airdrop(provider.connection, attacker.publicKey);
      const payerAta = await fundWalletWithUsdc(provider, mintAuthority, mint, payerA, 50);

      const escrowId = nextEscrowId();
      const [escrowPda] = findEscrowPda(program, payerA.publicKey, escrowId);

      await program.methods
        .initializeEscrow(escrowId, usdc(10), new BN(0))
        .accounts({
          payer: payerA.publicKey,
          merchant: merchant.publicKey,
          mint,
          payerTokenAccount: payerAta,
        } as any)
        .signers([payerA])
        .rpc();

      try {
        await program.methods
          .raiseDispute("ipfs://nope", new BN(60))
          .accounts({
            payer: attacker.publicKey, // not the escrow's payer
            escrow: escrowPda,
          } as any)
          .signers([attacker])
          .rpc();
        expect.fail("expected Unauthorized");
      } catch (err) {
        expectAnchorError(err, "Unauthorized");
      }
    });

    it("cast_vote from a wallet without a Juror PDA → AccountNotInitialized", async () => {
      const ctx = await setupDispute({ amountUsdc: 25, votingWindowSeconds: 120 });
      const ghost = Keypair.generate();
      await airdrop(provider.connection, ghost.publicKey);

      try {
        await program.methods
          .castVote({ refund: {} })
          .accounts({
            authority: ghost.publicKey,
            dispute: ctx.disputePda,
          } as any)
          .signers([ghost])
          .rpc();
        expect.fail("expected AccountNotInitialized for the missing Juror PDA");
      } catch (err) {
        // The Juror account constraint can't be satisfied — Anchor's auto-derived
        // account fetcher fails with AccountNotInitialized before the handler runs.
        expectAnchorError(err, "AccountNotInitialized");
      }
    });

    it("the same juror cannot vote twice on the same dispute", async () => {
      const ctx = await setupDispute({ amountUsdc: 40, votingWindowSeconds: 120 });
      const j = await registerJuror();

      await castVote(j, ctx.disputePda, "refund");

      // Second vote attempts to `init` the same Vote PDA — Solana's runtime
      // rejects creating an already-existing account. We pre-derive the PDA so
      // we can confirm it really exists between the two attempts.
      const [votePda] = findVotePda(program, ctx.disputePda, j.pda);
      expect(await accountExists(provider.connection, votePda)).to.be.true;

      try {
        await castVote(j, ctx.disputePda, "release");
        expect.fail("expected duplicate-vote attempt to fail");
      } catch (err) {
        // System program: account already in use. Anchor surfaces this as a
        // raw transaction error, not a structured AnchorError code, so we
        // match on the well-known message fragment.
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).to.match(/already in use|custom program error: 0x0/i);
      }
    });
  });
});
