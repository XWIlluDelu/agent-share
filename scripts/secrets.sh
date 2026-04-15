#!/usr/bin/env bash
# secrets.sh — password-encrypted API key manager for ~/.agent-share
#
# Usage:
#   ./scripts/secrets.sh encrypt   — encrypt .env → secrets.env.enc  (commit the .enc file)
#   ./scripts/secrets.sh decrypt   — decrypt secrets.env.enc → .env
#   ./scripts/secrets.sh install   — decrypt + append exports to ~/.zshrc (idempotent)
#   ./scripts/secrets.sh show      — decrypt and print to stdout (never written to disk)
#
# Algorithm: AES-256-CBC with PBKDF2-HMAC-SHA256, 600k iterations (OWASP 2024 recommendation)
# Dependency: openssl (system-provided)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
ENC_FILE="$REPO_DIR/secrets.env.enc"
MARKER="# agent-share secrets — managed by secrets.sh"

_openssl_enc() {
    openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 "$@"
}

cmd="${1:-}"

case "$cmd" in

encrypt)
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "Error: $ENV_FILE not found. Create it first." >&2
        exit 1
    fi
    echo "Encrypting $ENV_FILE → $ENC_FILE"
    _openssl_enc -in "$ENV_FILE" -out "$ENC_FILE"
    echo "Done. Commit secrets.env.enc to git."
    ;;

decrypt)
    if [[ ! -f "$ENC_FILE" ]]; then
        echo "Error: $ENC_FILE not found." >&2
        exit 1
    fi
    echo "Decrypting $ENC_FILE → $ENV_FILE"
    _openssl_enc -d -in "$ENC_FILE" -out "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "Done. $ENV_FILE created (gitignored)."
    ;;

install)
    if [[ ! -f "$ENC_FILE" ]]; then
        echo "Error: $ENC_FILE not found." >&2
        exit 1
    fi
    # Decrypt to a temp file, never written as .env if user prefers
    TMP=$(mktemp)
    trap 'rm -f "$TMP"' EXIT
    _openssl_enc -d -in "$ENC_FILE" -out "$TMP"

    SHELL_RC="${ZDOTDIR:-$HOME}/.zshrc"
    [[ -f "$SHELL_RC" ]] || SHELL_RC="$HOME/.bashrc"

    # Remove old block if present (idempotent)
    if grep -qF "$MARKER" "$SHELL_RC" 2>/dev/null; then
        # Remove from marker line to the next blank line following it
        perl -i -0pe "s/\n$MARKER\n.*?\n\n/\n/s" "$SHELL_RC"
        echo "Removed previous secrets block from $SHELL_RC"
    fi

    # Append new block
    {
        echo ""
        echo "$MARKER"
        while IFS= read -r line || [[ -n "$line" ]]; do
            # Skip blank lines and comments
            [[ -z "$line" || "$line" == \#* ]] && continue
            echo "export $line"
        done < "$TMP"
        echo ""
    } >> "$SHELL_RC"

    echo "Done. Secrets exported in $SHELL_RC."
    echo "Run: source $SHELL_RC  (or open a new terminal)"
    ;;

show)
    if [[ ! -f "$ENC_FILE" ]]; then
        echo "Error: $ENC_FILE not found." >&2
        exit 1
    fi
    echo "--- decrypted contents (not written to disk) ---"
    _openssl_enc -d -in "$ENC_FILE"
    echo "--- end ---"
    ;;

*)
    cat <<'USAGE'
Usage: scripts/secrets.sh <command>

  encrypt   Encrypt .env → secrets.env.enc  (then commit the .enc file)
  decrypt   Decrypt secrets.env.enc → .env
  install   Decrypt + write exports to ~/.zshrc (idempotent, no .env created)
  show      Decrypt and print to stdout only

Workflow (first machine):
  1. Create .env with your API keys
  2. ./scripts/secrets.sh encrypt
  3. git add secrets.env.enc && git commit

Workflow (new machine):
  git clone <repo> && cd <repo>
  ./scripts/secrets.sh install
  source ~/.zshrc
USAGE
    ;;
esac
