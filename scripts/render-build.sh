#!/usr/bin/env bash
# Render build. Build hosts report many CPUs, and Turbopack sizes its thread pools to them,
# which ran the 8 GB build out of memory; cap the pools and log what the host reports.
set -euo pipefail
echo "build host: nproc=$(nproc) node_parallelism=$(node -p 'require("os").availableParallelism()')"
free -m || true
corepack enable
pnpm install --frozen-lockfile
TOKIO_WORKER_THREADS=2 RAYON_NUM_THREADS=2 pnpm build
