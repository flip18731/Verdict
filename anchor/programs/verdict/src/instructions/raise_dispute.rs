use anchor_lang::prelude::*;

use crate::errors::VerdictError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus, MAX_EVIDENCE_URI_LEN, PANEL_SIZE};

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.payer.as_ref(), &escrow.escrow_id.to_le_bytes()],
        bump = escrow.bump,
        has_one = payer @ VerdictError::Unauthorized,
        constraint = escrow.status == EscrowStatus::Funded @ VerdictError::EscrowNotFunded,
        constraint = escrow.dispute.is_none() @ VerdictError::DisputeAlreadyExists,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = payer,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump,
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

pub fn raise_dispute_handler(
    ctx: Context<RaiseDispute>,
    evidence_uri: String,
    voting_window_seconds: i64,
) -> Result<()> {
    require!(
        evidence_uri.len() <= MAX_EVIDENCE_URI_LEN,
        VerdictError::EvidenceUriTooLong
    );

    let now = Clock::get()?.unix_timestamp;

    let dispute = &mut ctx.accounts.dispute;
    dispute.bump = ctx.bumps.dispute;
    dispute.escrow = ctx.accounts.escrow.key();
    dispute.raised_by = ctx.accounts.payer.key();
    dispute.evidence_uri = evidence_uri;
    dispute.voting_ends_at = now.saturating_add(voting_window_seconds);
    dispute.votes_for_refund = 0;
    dispute.votes_for_release = 0;
    dispute.status = DisputeStatus::Open;
    dispute.outcome = None;
    dispute.jurors_seated = PANEL_SIZE;
    dispute.jurors_voted = 0;

    let escrow = &mut ctx.accounts.escrow;
    escrow.status = EscrowStatus::Disputed;
    escrow.dispute = Some(dispute.key());

    Ok(())
}
