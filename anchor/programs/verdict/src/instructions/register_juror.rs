use anchor_lang::prelude::*;

use crate::state::Juror;

#[derive(Accounts)]
pub struct RegisterJuror<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Juror::INIT_SPACE,
        seeds = [b"juror", authority.key().as_ref()],
        bump,
    )]
    pub juror: Account<'info, Juror>,

    pub system_program: Program<'info, System>,
}

pub fn register_juror_handler(ctx: Context<RegisterJuror>) -> Result<()> {
    let juror = &mut ctx.accounts.juror;
    juror.bump = ctx.bumps.juror;
    juror.authority = ctx.accounts.authority.key();
    juror.reputation = 0;
    juror.cases_voted = 0;
    juror.is_active = true;
    Ok(())
}
