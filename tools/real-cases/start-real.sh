#!/bin/sh
# The real-case app: the production build on port 3200, its own database,
# DeepSeek from the environment (DOSSIER_AI_PROVIDER=deepseek, the alias this
# branch adds), and real job sites through the session's proxy.
set -eu
export DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/dossier_real}
cd "$(dirname "$0")/../.."
yarn prisma migrate deploy
yarn prisma db seed
export DOSSIER_PASSWORD='argon2id:m=19456,t=2,p=1:wk-0a22NLDwpNVDMxLY9rw:x4bAXEh9EtlaTIqLiHwF_omyDOpcPtwPrV0_SJx_y2c'
export DOSSIER_SECRET=real-case-secret-real-case-secret-123
export DOSSIER_DATA_DIR=${DOSSIER_DATA_DIR:-/tmp/dossier-real}
export DOSSIER_AI_PROVIDER=deepseek
export DOSSIER_AI_MODEL=deepseek-flash
export DOSSIER_TELEMETRY=off
# Behind a proxy (cloud sessions), also: export NODE_USE_ENV_PROXY=1
export PORT=3200 HOSTNAME=127.0.0.1
exec node .next/standalone/server.js
