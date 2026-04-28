use anchor_lang::prelude::*;

declare_id!("F6r87m6HEj3Seh9yBmghkPfQBSk1i8mNAMThYWkmbqvy");

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
