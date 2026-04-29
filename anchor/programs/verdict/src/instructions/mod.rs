pub mod cast_vote;
pub mod claim_juror_reward;
pub mod initialize_escrow;
pub mod raise_dispute;
pub mod register_juror;
pub mod release_escrow;
pub mod resolve_dispute;

// Glob re-export every module's public items so Anchor's #[program] macro
// can find both the Accounts structs and the auto-generated companion modules
// (e.g. `__client_accounts_*`) at crate root. Handler fns are named uniquely
// per instruction (e.g. `register_juror_handler`) to keep the globs collision-free.
pub use cast_vote::*;
pub use claim_juror_reward::*;
pub use initialize_escrow::*;
pub use raise_dispute::*;
pub use register_juror::*;
pub use release_escrow::*;
pub use resolve_dispute::*;
