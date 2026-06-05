#!/usr/bin/env bash
#
# deploy-merchant.sh — deploy one merchant-agent as its own Fly app, then
# register its agent-card on Base ERC-8004.
#
# One Fly app per merchant (Fly's native model). The wumingchu app is NOT
# touched by this script — it only creates the new four-seasons apps.
#
# Usage:
#   ./deploy-merchant.sh four-seasons-hangzhou  deploy     # create + deploy + seed + cert
#   ./deploy-merchant.sh four-seasons-hangzhou  register   # run sync-card locally → on-chain
#
# The owner private key is read from the environment and used ONLY by the
# local `register` step. It is never stored as a Fly secret, never printed.
#   export SYNC_PRIVATE_KEY=0x...     # e.g.  source <(grep _PRIVATE_KEY ../.env.merchants)
#
# Prereqs: flyctl logged in (`fly auth whoami`), this repo built once
#          (`pnpm --filter agent build`), run from merchant-agent-template/.
set -euo pipefail

MERCHANT="${1:?usage: deploy-merchant.sh <merchant> <deploy|register>}"
CMD="${2:-deploy}"

# Shared Base Sepolia config (same values as wumingchu's fly secrets).
REGION="nrt"
IDENTITY_REGISTRY="0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f"
REPUTATION_REGISTRY="0xcaC08083B58c7736bDf953dafeC3C3395f0D90c6"
USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
RPC_URL="https://sepolia.base.org"

case "$MERCHANT" in
  four-seasons-hangzhou)
    APP="concourse-fs-hangzhou"
    SUBDOMAIN="fourseasons-hangzhou.concourse.paking.xyz"
    OWNER="0x5A0Ccd7458c2EAb15AaA6B04D46f221177F244E7"   # second burner wallet
    ;;
  four-seasons-guangzhou)
    APP="concourse-fs-guangzhou"
    SUBDOMAIN="fourseasons-guangzhou.concourse.paking.xyz"
    OWNER="0x56b0666c4fe6F3BA5572aC7AC99AF7Ede58b67b4"   # deployer wallet
    ;;
  *)
    echo "Unknown merchant '$MERCHANT' (expected four-seasons-hangzhou | four-seasons-guangzhou)" >&2
    exit 1
    ;;
esac
PUBLIC_URL="https://$SUBDOMAIN"

case "$CMD" in
  deploy)
    echo "▸ deploying $MERCHANT as Fly app $APP ($PUBLIC_URL)"

    fly apps create "$APP" --org personal 2>/dev/null \
      || echo "  app $APP already exists — continuing"
    fly volumes create agent_data --size 1 --region "$REGION" -a "$APP" --yes 2>/dev/null \
      || echo "  volume already exists — continuing"

    # NOTE: SYNC_PRIVATE_KEY is deliberately NOT set here. The agent process
    # never needs it; only the local register step does.
    fly secrets set -a "$APP" \
      MERCHANT="$MERCHANT" \
      PUBLIC_URL="$PUBLIC_URL" \
      AGENT_OWNER_ADDRESS="$OWNER" \
      IDENTITY_REGISTRY="$IDENTITY_REGISTRY" \
      REPUTATION_REGISTRY="$REPUTATION_REGISTRY" \
      CHAIN_ID="84532" \
      RPC_URL="$RPC_URL" \
      USDC_ADDRESS="$USDC_ADDRESS"

    fly deploy -a "$APP"

    echo "▸ seeding merchant data into the SQLite volume"
    fly ssh console -a "$APP" -C "node /app/apps/agent/dist/scripts/setup.js"

    echo "▸ requesting TLS cert for $SUBDOMAIN"
    fly certs add "$SUBDOMAIN" -a "$APP"

    cat <<EOF

✓ $APP deployed and seeded.

NEXT (manual — DNS is in your registrar, not Fly):
  1. Add a DNS CNAME:   $SUBDOMAIN  →  $APP.fly.dev
  2. Wait for the cert:  fly certs show $SUBDOMAIN -a $APP   (until "issued")
  3. Verify the card:    curl https://$SUBDOMAIN/.well-known/agent-card.json
  4. Register on-chain:  export SYNC_PRIVATE_KEY=<owner key>
                         ./deploy-merchant.sh $MERCHANT register
EOF
    ;;

  register)
    : "${SYNC_PRIVATE_KEY:?export SYNC_PRIVATE_KEY (the $OWNER owner key) before registering}"

    echo "▸ checking card is live at $PUBLIC_URL"
    curl -sf "$PUBLIC_URL/.well-known/agent-card.json" >/dev/null \
      || { echo "  card not reachable yet — finish DNS + cert first"; exit 1; }

    # Run sync-card LOCALLY against the live URL. The key stays on this machine.
    cd apps/agent
    echo "▸ dry-run (no broadcast)"
    RPC_URL="$RPC_URL" IDENTITY_REGISTRY="$IDENTITY_REGISTRY" \
      PUBLIC_URL="$PUBLIC_URL" SYNC_PRIVATE_KEY="$SYNC_PRIVATE_KEY" \
      node dist/scripts/sync-card.js --dry-run

    read -r -p "Broadcast the register tx for $MERCHANT? [y/N] " ok
    if [ "$ok" = "y" ] || [ "$ok" = "Y" ]; then
      RPC_URL="$RPC_URL" IDENTITY_REGISTRY="$IDENTITY_REGISTRY" \
        PUBLIC_URL="$PUBLIC_URL" SYNC_PRIVATE_KEY="$SYNC_PRIVATE_KEY" \
        node dist/scripts/sync-card.js
      echo "✓ registered. Verify:  npx @concourse-protocol/discover list"
    else
      echo "  aborted — nothing broadcast."
    fi
    ;;

  *)
    echo "Unknown command '$CMD' (expected deploy | register)" >&2
    exit 1
    ;;
esac
