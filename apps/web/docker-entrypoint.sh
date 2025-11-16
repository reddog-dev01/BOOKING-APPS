#!/bin/sh
set -euo pipefail

# Preserve the container-provided hostname for debugging purposes.
if [ "${ORIGINAL_HOSTNAME:-}" = "" ] && [ "${HOSTNAME:-}" != "" ]; then
  export ORIGINAL_HOSTNAME="${HOSTNAME}"
fi

# Allow override via NEXT_BIND_HOST but default to 0.0.0.0 so Next.js binds to all interfaces.
HOST_BIND="${NEXT_BIND_HOST:-0.0.0.0}"

exec env HOSTNAME="$HOST_BIND" node apps/web/server.js
