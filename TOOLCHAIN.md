# Toolchain

These are the verified versions used to build Verdict. Captured during Phase 0.

| Tool          | Version                                            |
| ------------- | -------------------------------------------------- |
| `rustc`       | 1.94.1 (host) / 1.79.0 (used to compile anchor-cli) |
| `cargo`       | bundled with rustc 1.94.1                          |
| `solana`      | solana-cli 1.18.26 (Agave, src:c2b35002)           |
| `anchor`      | anchor-cli 0.30.1 (via avm)                        |
| `avm`         | 0.30.1                                             |
| `node`        | v22.22.2                                           |
| `npm`         | 10.9.7                                             |
| `pnpm`        | 10.33.0                                            |

## Notes

- Solana 1.18.26 from anza-xyz/agave releases.
- Anchor 0.30.1 had to be compiled with `RUSTUP_TOOLCHAIN=1.79.0` because newer
  rustc trips the `time-0.x` build-script bug (E0282). The compiled
  `anchor` binary itself is portable.
- The on-chain BPF program is compiled by `cargo-build-sbf` (shipped with the
  Solana toolchain) using the platform-tools Rust, not the host rustc, so the
  host rustc version doesn't affect on-chain artifacts.
