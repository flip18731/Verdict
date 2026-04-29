use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::VerdictError;
use crate::state::{Escrow, EscrowStatus};

#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: only used as a Pubkey reference; never read or written.
    pub merchant: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = payer_token_account.mint == mint.key(),
        constraint = payer_token_account.owner == payer.key(),
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", payer.key().as_ref(), &escrow_id.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = escrow,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_escrow_handler(
    ctx: Context<InitializeEscrow>,
    escrow_id: u64,
    amount: u64,
    release_after: i64,
) -> Result<()> {
    require!(amount > 0, VerdictError::InvalidAmount);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.bump = ctx.bumps.escrow;
    escrow.escrow_id = escrow_id;
    escrow.payer = ctx.accounts.payer.key();
    escrow.merchant = ctx.accounts.merchant.key();
    escrow.mint = ctx.accounts.mint.key();
    escrow.amount = amount;
    escrow.vault = ctx.accounts.vault.key();
    escrow.status = EscrowStatus::Funded;
    escrow.dispute = None;
    escrow.created_at = Clock::get()?.unix_timestamp;
    escrow.release_after = release_after;

    Ok(())
}
