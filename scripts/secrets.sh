#!/usr/bin/env bash
# secrets.sh — password-encrypted API key manager for ~/.agent-share
#
# Usage:
#   ./scripts/secrets.sh encrypt   — encrypt .env → secrets.env.enc  (commit the .enc file)
#   ./scripts/secrets.sh decrypt   — decrypt secrets.env.enc → .env
#   ./scripts/secrets.sh show      — decrypt and print to stdout (never written to disk)
#
# Algorithm: AES-256-CBC with PBKDF2-HMAC-SHA256, 600k iterations
# Dependency: openssl (system-provided)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
ENC_FILE="$REPO_DIR/secrets.env.enc"

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
    echo ""
    echo "To load on every new shell, add this line to ~/.zshrc:"
    echo "  [[ -f $ENV_FILE ]] && source $ENV_FILE"
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
  show      Decrypt and print to stdout only (no file written)

Workflow (first machine):
  1. Create ~/.agent-share/.env with your API keys
  2. ./scripts/secrets.sh encrypt
  3. git add secrets.env.enc && git commit && git push

Workflow (new machine):
  git clone <repo> ~/.agent-share
  ./scripts/secrets.sh decrypt
  # Then add to ~/.zshrc:
  #   [[ -f ~/.agent-share/.env ]] && source ~/.agent-share/.env
  source ~/.zshrc
USAGE
    ;;
esac
