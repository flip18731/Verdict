// Anchor 0.31.1's #[program] macro still calls the deprecated
// AccountInfo::realloc (renamed to resize() in solana-program 1.18+). Fixed
// upstream in Anchor 0.32+. Whitelist here so otherwise-clean builds stay
// warning-free. Remove this when bumping Anchor.
#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("69NkKNcJFMcBbtTzt9t3Xx9nWF67i1dMrG74nU54bNRR");

#[program]
pub mod verdict {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
