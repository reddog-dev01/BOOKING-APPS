#!/bin/sh
set -eu

URL="http://127.0.0.1:${PORT:-3006}/healthz"

if command -v curl >/dev/null 2>&1; then
  curl -fsS "$URL" >/dev/null
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$URL" >/dev/null
else
  echo "no http client available" >&2
  exit 1
fi
