#!/usr/bin/env bash
# Replace the cached Agave platform-tools with v1.54 so anchor build can
# resolve modern crates that declare `edition = "2024"`. See TOOLCHAIN.md
# for the full story. Idempotent — leaves a .bak of the original on first run
# only and refuses to overwrite an existing v1.54 install.
set -euo pipefail

CACHE_DIR="$HOME/.cache/solana/v1.48/platform-tools"
BACKUP_DIR="$HOME/.cache/solana/v1.48/platform-tools.bak"
TARBALL_URL="https://github.com/anza-xyz/platform-tools/releases/download/v1.54/platform-tools-linux-x86_64.tar.bz2"
TARBALL_TMP="/tmp/platform-tools-v1.54.tar.bz2"

if [ -d "$CACHE_DIR" ] && [ -f "$CACHE_DIR/version.md" ] && grep -q "daa3af4a1110ec3f10ce08083bb0b7855a88416f" "$CACHE_DIR/version.md" 2>/dev/null; then
  echo "[setup-toolchain] platform-tools v1.54 already installed at $CACHE_DIR — nothing to do."
  exit 0
fi

if [ -d "$CACHE_DIR" ] && [ ! -d "$BACKUP_DIR" ]; then
  echo "[setup-toolchain] backing up the existing install to $BACKUP_DIR"
  mv "$CACHE_DIR" "$BACKUP_DIR"
elif [ -d "$CACHE_DIR" ]; then
  echo "[setup-toolchain] backup already exists; removing stale current install"
  rm -rf "$CACHE_DIR"
fi

mkdir -p "$CACHE_DIR"
echo "[setup-toolchain] downloading platform-tools v1.54..."
curl -sSfL -o "$TARBALL_TMP" "$TARBALL_URL"
echo "[setup-toolchain] extracting into $CACHE_DIR..."
tar -xjf "$TARBALL_TMP" -C "$CACHE_DIR"
rm -f "$TARBALL_TMP"

echo "[setup-toolchain] done. rustc:"
"$CACHE_DIR/rust/bin/rustc" --version
"$CACHE_DIR/rust/bin/cargo" --version
