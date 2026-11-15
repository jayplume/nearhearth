#!/usr/bin/env bash
# Sets the two secrets the scheduled keeper swarm needs on GitHub: NEAR_KEYS (keeper-01..13 and the
# fund, from this machine's NEAR CLI credentials) and NEARAI_API_KEY (for the AI keeper, keeper-13).
# It checks everything before it changes anything, so a missing file can't leave the swarm without
# keys, and it never prints a key.
#
#   bash scripts/set-github-secrets.sh --check                            # checks only, changes nothing
#   bash scripts/set-github-secrets.sh                                    # AI key from $NEARAI_API_KEY or ./.env
#   NEARAI_ENV_FILE=../nearvoice/.env bash scripts/set-github-secrets.sh  # AI key from another .env file
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-jayplume/nearhearth}"
CREDS="${NEAR_CREDENTIALS_DIR:-$HOME/.near-credentials}/testnet"

command -v gh >/dev/null || { echo "The GitHub CLI is missing: brew install gh, then gh auth login" >&2; exit 1; }
if [ "$(gh api "repos/$REPO" --jq .permissions.admin 2>/dev/null)" != "true" ]; then
  echo "The active GitHub account ($(gh api user --jq .login 2>/dev/null || echo 'not logged in')) can't set secrets on $REPO." >&2
  echo "Switch to the owner first: gh auth switch --user ${REPO%%/*}" >&2
  exit 1
fi

# 1. The keepers' and the fund's keys as one JSON object (the swarm job reads NEAR_KEYS).
KEYS="$(python3 - "$CREDS" <<'PY'
import json, os, sys
d = sys.argv[1]
ids = [f"keeper-{n:02d}.nearhearth.testnet" for n in range(1, 14)] + ["nearhearth-fund.testnet"]
missing = [i for i in ids if not os.path.isfile(os.path.join(d, i + ".json"))]
if missing:
    sys.exit(f"No key file in {d} for: {', '.join(missing)}. Nothing was changed.")
print(json.dumps({i: json.load(open(os.path.join(d, i + ".json")))["private_key"] for i in ids}), end="")
PY
)"

# 2. The NEAR AI Cloud key.
if [ -z "${NEARAI_API_KEY:-}" ]; then
  f="${NEARAI_ENV_FILE:-.env}"
  if [ -f "$f" ]; then
    NEARAI_API_KEY="$(sed -nE 's/^[[:space:]]*(export[[:space:]]+)?NEARAI_API_KEY=//p' "$f" | tail -n 1 | tr -d "\"'\r\t ")"
  fi
fi
[ -n "${NEARAI_API_KEY:-}" ] || { echo "No NEAR AI key found. Pass NEARAI_API_KEY=... or NEARAI_ENV_FILE=path/to/.env. Nothing was changed." >&2; exit 1; }

if [ "${1:-}" = "--check" ]; then
  echo "Ready: 14 keys (keeper-01..13 and the fund) and a NEAR AI key found; $(gh api user --jq .login) can set secrets on $REPO."
  echo "Nothing was changed. Run again without --check to set them."
  exit 0
fi

# 3. Only now change anything.
printf %s "$KEYS" | gh secret set NEAR_KEYS --repo "$REPO"
printf %s "$NEARAI_API_KEY" | gh secret set NEARAI_API_KEY --repo "$REPO"
echo "Secrets on $REPO (names and dates only):"
gh secret list --repo "$REPO"
echo "To see the AI keeper play now: gh workflow run swarm.yml --repo $REPO"
