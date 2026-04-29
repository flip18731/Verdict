// Anchor 0.31.1's #[program] macro still calls the deprecated
// AccountInfo::realloc (renamed to resize() in solana-program 1.18+). Fixed
// upstream in Anchor 0.32+. Whitelist here so otherwise-clean builds stay
// warning-free. Remove this when bumping Anchor.
#![allow(deprecated)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::DisputeOutcome;

declare_id!("69NkKNcJFMcBbtTzt9t3Xx9nWF67i1dMrG74nU54bNRR");

#[program]
pub mod verdict {
    use super::*;

    pub fn register_juror(ctx: Context<RegisterJuror>) -> Result<()> {
        register_juror_handler(ctx)
    }

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        escrow_id: u64,
        amount: u64,
        release_after: i64,
    ) -> Result<()> {
        initialize_escrow_handler(ctx, escrow_id, amount, release_after)
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        release_escrow_handler(ctx)
    }

    pub fn raise_dispute(
        ctx: Context<RaiseDispute>,
        evidence_uri: String,
        voting_window_seconds: i64,
    ) -> Result<()> {
        raise_dispute_handler(ctx, evidence_uri, voting_window_seconds)
    }

    pub fn cast_vote(ctx: Context<CastVote>, choice: DisputeOutcome) -> Result<()> {
        cast_vote_handler(ctx, choice)
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
        resolve_dispute_handler(ctx)
    }

    pub fn claim_juror_reward(ctx: Context<ClaimJurorReward>) -> Result<()> {
        claim_juror_reward_handler(ctx)
    }
}
