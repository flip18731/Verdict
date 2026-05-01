// Type re-exports + JS-side enum representations matching how the
// `@coral-xyz/anchor` client deserializes Anchor enums.
//
// Anchor maps `enum Foo { Bar, Baz }` to a tagged-object form on the JS side:
//   Bar  →  { bar: {} }
//   Baz  →  { baz: {} }
// We preserve that exact shape so callers can compare with deepEqual without
// extra translation.

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import type { Verdict } from "./types/verdict";

export type Escrow = IdlAccounts<Verdict>["escrow"];
export type Dispute = IdlAccounts<Verdict>["dispute"];
export type Juror = IdlAccounts<Verdict>["juror"];
export type Vote = IdlAccounts<Verdict>["vote"];

export type EscrowStatus = IdlTypes<Verdict>["escrowStatus"];
export type DisputeStatus = IdlTypes<Verdict>["disputeStatus"];
export type DisputeOutcome = IdlTypes<Verdict>["disputeOutcome"];

// Concrete enum value constructors for the cast_vote / resolve outcome shapes.
// (Anchor 0.31 exposes the discriminant via the lowercase variant key.)
export const DisputeOutcome = {
  refund: { refund: {} } as DisputeOutcome,
  release: { release: {} } as DisputeOutcome,
} as const;

export const EscrowStatus = {
  funded: { funded: {} } as EscrowStatus,
  released: { released: {} } as EscrowStatus,
  disputed: { disputed: {} } as EscrowStatus,
  refunded: { refunded: {} } as EscrowStatus,
} as const;

export const DisputeStatus = {
  open: { open: {} } as DisputeStatus,
  resolved: { resolved: {} } as DisputeStatus,
} as const;
