use anchor_lang::prelude::*;

#[error_code]
pub enum VerdictError {
    #[msg("Escrow amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Caller is not authorized for this action.")]
    Unauthorized,
    #[msg("Escrow is not in the Funded state.")]
    EscrowNotFunded,
    #[msg("Escrow is not in the Disputed state.")]
    EscrowNotDisputed,
    #[msg("Escrow already has an active dispute.")]
    DisputeAlreadyExists,
    #[msg("Dispute has already been resolved.")]
    DisputeAlreadyResolved,
    #[msg("Voting window has already ended.")]
    VotingEnded,
    #[msg("Voting window has not ended yet, and the panel is not full.")]
    VotingNotEnded,
    #[msg("This juror has already voted on this dispute.")]
    JurorAlreadyVoted,
    #[msg("Juror account is not active.")]
    JurorInactive,
    #[msg("Evidence URI exceeds the 256-byte maximum.")]
    EvidenceUriTooLong,
    #[msg("Dispute panel is already full (3 jurors).")]
    PanelFull,
    #[msg("This wallet is not a seated juror for this dispute.")]
    NotASeatedJuror,
}
