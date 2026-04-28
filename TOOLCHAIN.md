# Toolchain

These are the verified versions used to build Verdict. Captured during Phase 0,
updated through Phase 1 toolchain remediation.

| Tool          | Version                                                         |
| ------------- | --------------------------------------------------------------- |
| `rustc` (host)| 1.94.1                                                          |
| `cargo` (host)| bundled with rustc 1.94.1                                       |
| `solana`      | agave 2.3.13 (Anza fork; replaced solana-cli 1.18.26)           |
| `cargo-build-sbf` | 2.3.13                                                      |
| platform-tools | v1.54 (rustc/cargo 1.89, manually swapped — see below)         |
| `anchor`      | anchor-cli 0.30.1 (via avm)                                     |
| `avm`         | 0.30.1                                                          |
| `node`        | v22.22.2                                                        |
| `npm`         | 10.9.7                                                          |
| `pnpm`        | 10.33.0                                                         |

## Notes

- Anchor 0.30.1 had to be compiled with `RUSTUP_TOOLCHAIN=1.79.0` because newer
  rustc trips the `time-0.x` build-script bug (E0282). The compiled
  `anchor` binary itself is portable.
- The on-chain BPF program is compiled by `cargo-build-sbf` using the
  platform-tools-bundled Rust, not the host rustc.

## Non-standard step: platform-tools v1.54 swap

Agave 2.3.13's `cargo-build-sbf` looks up its bundled toolchain in
`~/.cache/solana/v1.48/platform-tools/`. The release ships
**platform-tools v1.48 with cargo 1.84.0**, which predates `edition2024`
stabilization (cargo 1.85). The current crates.io has many transitive deps
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

