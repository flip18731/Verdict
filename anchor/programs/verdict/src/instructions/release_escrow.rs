use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::errors::VerdictError;
use crate::state::{Escrow, EscrowStatus};

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.payer.as_ref(), &escrow.escrow_id.to_le_bytes()],
        bump = escrow.bump,
        has_one = payer @ VerdictError::Unauthorized,
        has_one = vault @ VerdictError::Unauthorized,
        constraint = escrow.status == EscrowStatus::Funded @ VerdictError::EscrowNotFunded,
        close = payer,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
        constraint = vault.mint == escrow.mint @ VerdictError::Unauthorized,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = merchant_token_account.mint == escrow.mint @ VerdictError::Unauthorized,
        constraint = merchant_token_account.owner == escrow.merchant @ VerdictError::Unauthorized,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn release_escrow_handler(ctx: Context<ReleaseEscrow>) -> Result<()> {
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

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.payer.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    ctx.accounts.escrow.status = EscrowStatus::Released;

    Ok(())
}
