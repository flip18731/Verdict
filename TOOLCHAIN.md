# Toolchain

Final working stack after Phase 1 remediation. The path to get here is
documented at the bottom — read that section before changing any pinned
version.

| Tool              | Version                                                      |
| ----------------- | ------------------------------------------------------------ |
| `rustc` (host)    | 1.94.1                                                       |
| `cargo` (host)    | bundled with rustc 1.94.1                                    |
| `solana`          | agave 2.3.13 (Anza fork)                                     |
| `cargo-build-sbf` | 2.3.13                                                       |
| platform-tools    | v1.54 (rustc/cargo 1.89, manually swapped into v1.48 cache)  |
| `anchor` / `avm`  | 0.31.1                                                       |
| `@coral-xyz/anchor` (npm) | 0.31.1                                                |
| `@solana/web3.js` | 1.95.3                                                       |
| `@solana/spl-token` | 0.4.8                                                      |
| `node`            | v22.22.2                                                     |
| `npm`             | 10.9.7                                                       |
| `pnpm`            | 10.33.0                                                      |

## Notes

- `anchor-cli` had to be compiled with `RUSTUP_TOOLCHAIN=1.79.0` (both 0.30.1
  and 0.31.1) because newer rustc trips the `time-0.x` build-script bug
  (E0282). The compiled `anchor` binary itself is portable.
- The on-chain SBF program is compiled by `cargo-build-sbf` using the
  platform-tools-bundled Rust (1.89 after the swap below), not the host rustc.

## Non-standard step: platform-tools v1.54 swap

Agave 2.3.13's `cargo-build-sbf` looks up its bundled toolchain in
`~/.cache/solana/v1.48/platform-tools/`. The release ships
**platform-tools v1.48 with cargo 1.84.0**, which predates `edition2024`
stabilization (cargo 1.85). Current crates.io has many transitive deps
(`indexmap >= 2.10`, `block-buffer >= 0.12`, `cmov >= 0.5`, `toml_parser`,
`wit-bindgen >= 0.57`, ...) that declare `edition = "2024"` in their manifests,
which cargo 1.84 cannot parse — causing `anchor build` to fail at
`cargo metadata` time.

Remediation: replace the cached platform-tools v1.48 directory with a v1.54
tarball from `anza-xyz/platform-tools` (rustc/cargo 1.89, edition2024 native).
Layout matches (`rust/`, `llvm/`, `version.md`), and Agave 2.x already uses
the new `sbpf-solana-solana` target naming, so no symlink/rename gymnastics.

```bash
mv ~/.cache/solana/v1.48/platform-tools ~/.cache/solana/v1.48/platform-tools.bak
mkdir -p ~/.cache/solana/v1.48/platform-tools
curl -L https://github.com/anza-xyz/platform-tools/releases/download/v1.54/platform-tools-linux-x86_64.tar.bz2 \
  | tar -xjf - -C ~/.cache/solana/v1.48/platform-tools
```

> **Phase 6 TODO:** wrap this swap in `scripts/setup-toolchain.sh` and call it
> out as a prerequisite in the README bring-up sequence so a fresh clone
> reproduces the working state in one command.

## How we got here (toolchain saga, for the next maintainer)

This project's toolchain pinning is non-default because the standard Anchor
0.30.x + Solana 1.18.x combo no longer builds against today's crates.io. The
abbreviated path:

1. **Started:** Anchor 0.30.1 + Solana CLI 1.18.26 + platform-tools v1.41.
2. **Hit edition2024 wall:** registry pulls modern transitive deps that
   require `edition = "2024"`; platform-tools 1.41's cargo 1.75 can't parse
   them.
3. **Tried whack-a-mole pinning** of `blake3`, `proc-macro-crate`, `toml_edit`
   to last pre-edition2024 releases. Got further but new crates kept landing
   that needed pinning. Not converging.
4. **Tried platform-tools v1.54 swap under Solana 1.18.26.** Solved
   edition2024 parsing, but Solana 1.18.26's `cargo-build-sbf` looks for a
   prebuilt sysroot at `sbf-solana-solana/` while v1.54 ships only
   `sbpf-solana-solana/` (target was renamed). Symlink fix exposed deeper
   compatibility breaks (`meta_sized` lang item).
5. **Bumped to Agave 2.3.13** (uses the new `sbpf-` naming natively). New
   wall: Agave 2.3.13 ships platform-tools v1.48 with cargo 1.84.0, which is
   one minor before edition2024 stabilization (1.85).
6. **Swapped v1.48 cache contents for v1.54 tarball** (the surgery in the
   section above). SBF build now compiles end-to-end.
7. **Hit IDL build wall** in Anchor 0.30.1: `anchor-syn` calls
   `proc_macro2::Span::source_file()`, which proc-macro2 only exposes when
   `procmacro2_semver_exempt` is set. Anchor's own IDL builder sets it via
   RUSTFLAGS, but the underlying `proc_macro::Span::source_file()` API has
   been removed from host rustc 1.94 (renamed to `source`). No single rustup
   toolchain satisfies both "old enough for `source_file`" and "new enough
   for edition2024".
8. **Bumped Anchor to 0.31.1**, which dropped the `source_file` dependency
   in its IDL builder. SBF + IDL + types all build cleanly. Final stack.

Bumps that are believed safe in the future:
- Anchor 0.32.x (drops the `AccountInfo::realloc` deprecation that we
  currently `#![allow(deprecated)]` to suppress).
- platform-tools later than v1.54 (cargo only needs to keep up with crates.io
  edition increments).

Bumps that **will probably break the build**:
- Solana CLI 3.x (untested against Anchor 0.31; may bring its own
  platform-tools rename).
- Reverting to Anchor 0.30.x (the `source_file` issue returns).

