use anchor_lang::prelude::*;

use crate::errors::VerdictError;
use crate::state::{Dispute, DisputeStatus, Juror, Vote};

#[derive(Accounts)]
pub struct ClaimJurorReward<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"juror", authority.key().as_ref()],
        bump = juror.bump,
    )]
    pub juror: Account<'info, Juror>,

    #[account(
        seeds = [b"dispute", dispute.escrow.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Resolved @ VerdictError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [b"vote", dispute.key().as_ref(), juror.key().as_ref()],
        bump = vote.bump,
        has_one = juror @ VerdictError::NotASeatedJuror,
        has_one = dispute @ VerdictError::NotASeatedJuror,
        close = authority,
    )]
    pub vote: Account<'info, Vote>,
}

pub fn claim_juror_reward_handler(ctx: Context<ClaimJurorReward>) -> Result<()> {
    // resolve_dispute set dispute.outcome before flipping status to Resolved,
    // so the unwrap is sound.
    let outcome = ctx
        .accounts
        .dispute
        .outcome
        .ok_or(VerdictError::DisputeAlreadyResolved)?;

    if ctx.accounts.vote.choice == outcome {
        let juror = &mut ctx.accounts.juror;
        juror.reputation = juror.reputation.saturating_add(1);
    }

    Ok(())
}
