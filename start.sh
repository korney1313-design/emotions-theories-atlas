#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
mkdir -p .runtime
if ! curl -fsS --max-time 2 http://127.0.0.1:5174/atlas.json >/dev/null 2>&1; then
  if [ ! -d node_modules ]; then npm ci; fi
  nohup npm run dev -- --port 5174 --strictPort >.runtime/server.log 2>&1 </dev/null &
  echo $! > .runtime/server.pid
  ready=0
  for attempt in {1..40}; do
    if curl -fsS --max-time 1 http://127.0.0.1:5174/atlas.json >/dev/null 2>&1; then ready=1; break; fi
    sleep .25
  done
  if [ "$ready" = 0 ]; then cat .runtime/server.log; exit 1; fi
fi
if [ "${1:-}" != '--no-open' ]; then xdg-open http://127.0.0.1:5174/ >/dev/null 2>&1 || true; fi
printf 'Knowledge Atlas: http://127.0.0.1:5174/\n'
