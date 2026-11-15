#!/usr/bin/env bash
# Sets the two secrets the scheduled keeper swarm needs, from this machine's NEAR CLI keychain
# and a NEAR AI Cloud key. Nothing is printed. Run it yourself, once:
#   NEARAI_API_KEY=<your key> bash scripts/set-github-secrets.sh
set -euo pipefail
REPO="${REPO:-jayplume/nearhearth}"
python3 - <<'PY' | gh secret set NEAR_KEYS --repo "$REPO"
import json, os
d = os.path.expanduser(os.environ.get("NEAR_CREDENTIALS_DIR", "~/.near-credentials") + "/testnet")
ids = [f"keeper-{n:02d}.nearhearth.testnet" for n in range(1, 14)] + ["nearhearth-fund.testnet"]
print(json.dumps({i: json.load(open(f"{d}/{i}.json"))["private_key"] for i in ids}), end="")
PY
if [ -n "${NEARAI_API_KEY:-}" ]; then printf %s "$NEARAI_API_KEY" | gh secret set NEARAI_API_KEY --repo "$REPO"; fi
gh secret list --repo "$REPO"
