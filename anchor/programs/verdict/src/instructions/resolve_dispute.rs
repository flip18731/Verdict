use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::errors::VerdictError;
use crate::state::{Dispute, DisputeOutcome, DisputeStatus, Escrow, EscrowStatus};

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    /// The dispute payout's rent recipient. Must be the original escrow payer
    /// so account-close lamports flow back to the funder. Anyone can sign;
    /// economic incentive lives off-chain.
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.payer.as_ref(), &escrow.escrow_id.to_le_bytes()],
        bump = escrow.bump,
        has_one = vault @ VerdictError::Unauthorized,
        constraint = escrow.status == EscrowStatus::Disputed @ VerdictError::EscrowNotDisputed,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Open @ VerdictError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
        constraint = vault.mint == escrow.mint @ VerdictError::Unauthorized,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = payer_token_account.mint == escrow.mint @ VerdictError::Unauthorized,
        constraint = payer_token_account.owner == escrow.payer @ VerdictError::Unauthorized,
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = merchant_token_account.mint == escrow.mint @ VerdictError::Unauthorized,
        constraint = merchant_token_account.owner == escrow.merchant @ VerdictError::Unauthorized,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    /// CHECK: rent recipient for the closed vault — must be the original
    /// payer so lamports return to who funded the escrow.
    #[account(
        mut,
        constraint = payer_rent_recipient.key() == escrow.payer @ VerdictError::Unauthorized,
    )]
    pub payer_rent_recipient: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn resolve_dispute_handler(ctx: Context<ResolveDispute>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let dispute_voting_ended = now >= ctx.accounts.dispute.voting_ends_at;
    let panel_full = ctx.accounts.dispute.jurors_voted >= ctx.accounts.dispute.jurors_seated;
    require!(
        dispute_voting_ended || panel_full,
        VerdictError::VotingNotEnded
    );

    // Tie-breaker (including 0-0): default to Release. MVP design choice —
    // documented in the spec; favors merchants when nothing decisive is said.
    let outcome = if ctx.accounts.dispute.votes_for_refund > ctx.accounts.dispute.votes_for_release
    {
        DisputeOutcome::Refund
    } else {
        DisputeOutcome::Release
    };

    let amount = ctx.accounts.vault.amount;

    let payer_key = ctx.accounts.escrow.payer;
    let escrow_id_bytes = ctx.accounts.escrow.escrow_id.to_le_bytes();
    let escrow_bump = ctx.accounts.escrow.bump;
    let escrow_seeds: &[&[u8]] = &[
        b"escrow",
        payer_key.as_ref(),
        escrow_id_bytes.as_ref(),
        std::slice::from_ref(&escrow_bump),
    ];
    let signer_seeds: &[&[&[u8]]] = &[escrow_seeds];

    let destination = match outcome {
        DisputeOutcome::Refund => ctx.accounts.payer_token_account.to_account_info(),
        DisputeOutcome::Release => ctx.accounts.merchant_token_account.to_account_info(),
    };

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: destination,
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.payer_rent_recipient.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    let dispute = &mut ctx.accounts.dispute;
    dispute.status = DisputeStatus::Resolved;
    dispute.outcome = Some(outcome);

    let escrow = &mut ctx.accounts.escrow;
    escrow.status = match outcome {
        DisputeOutcome::Refund => EscrowStatus::Refunded,
        DisputeOutcome::Release => EscrowStatus::Released,
    };

    Ok(())
}
