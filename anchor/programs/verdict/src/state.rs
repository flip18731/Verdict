use anchor_lang::prelude::*;

pub const PANEL_SIZE: u8 = 3;
pub const MAX_EVIDENCE_URI_LEN: usize = 256;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum EscrowStatus {
    Funded,
    Released,
    Disputed,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DisputeOutcome {
    Refund,
    Release,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub bump: u8,
    pub escrow_id: u64,
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub vault: Pubkey,
    pub status: EscrowStatus,
    pub dispute: Option<Pubkey>,
    pub created_at: i64,
    pub release_after: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    pub bump: u8,
    pub escrow: Pubkey,
    pub raised_by: Pubkey,
    #[max_len(MAX_EVIDENCE_URI_LEN)]
    pub evidence_uri: String,
    pub voting_ends_at: i64,
    pub votes_for_refund: u32,
    pub votes_for_release: u32,
    pub status: DisputeStatus,
    pub outcome: Option<DisputeOutcome>,
    pub jurors_seated: u8,
    pub jurors_voted: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Juror {
    pub bump: u8,
    pub authority: Pubkey,
    pub reputation: u32,
    pub cases_voted: u32,
    pub is_active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Vote {
    pub bump: u8,
    pub dispute: Pubkey,
    pub juror: Pubkey,
    pub choice: DisputeOutcome,
    pub cast_at: i64,
}
