import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Verdict } from "../target/types/verdict";
import {
  airdrop,
  createEmptyAta,
  expectAnchorError,
  findEscrowPda,
  findVaultPda,
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
});
