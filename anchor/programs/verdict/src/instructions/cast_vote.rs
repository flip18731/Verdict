use anchor_lang::prelude::*;

use crate::errors::VerdictError;
use crate::state::{Dispute, DisputeOutcome, DisputeStatus, Juror, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"juror", authority.key().as_ref()],
        bump = juror.bump,
        constraint = juror.is_active @ VerdictError::JurorInactive,
    )]
    pub juror: Account<'info, Juror>,

    #[account(
        mut,
        seeds = [b"dispute", dispute.escrow.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Open @ VerdictError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    // Anchor's `init` enforces uniqueness — a second cast_vote from the same
    // (dispute, juror) pair fails because the Vote PDA already exists.
    #[account(
        init,
        payer = authority,
        space = 8 + Vote::INIT_SPACE,
        seeds = [b"vote", dispute.key().as_ref(), juror.key().as_ref()],
        bump,
    )]
    pub vote: Account<'info, Vote>,

    pub system_program: Program<'info, System>,
}

pub fn cast_vote_handler(ctx: Context<CastVote>, choice: DisputeOutcome) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let dispute = &mut ctx.accounts.dispute;

    require!(now < dispute.voting_ends_at, VerdictError::VotingEnded);
    require!(
        dispute.jurors_voted < dispute.jurors_seated,
        VerdictError::PanelFull
    );

    match choice {
        DisputeOutcome::Refund => dispute.votes_for_refund += 1,
        DisputeOutcome::Release => dispute.votes_for_release += 1,
    }
    dispute.jurors_voted += 1;

    let juror = &mut ctx.accounts.juror;
    juror.cases_voted += 1;

    let vote = &mut ctx.accounts.vote;
    vote.bump = ctx.bumps.vote;
    vote.dispute = dispute.key();
    vote.juror = juror.key();
    vote.choice = choice;
    vote.cast_at = now;

    Ok(())
}
