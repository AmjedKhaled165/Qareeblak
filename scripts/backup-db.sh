#!/bin/bash
# ============================================================
# Qareeblak — Automated PostgreSQL Backup to S3
# Run via cron: 0 2 * * * /srv/qareeblak/scripts/backup-db.sh >> /var/log/qareeblak-backup.log 2>&1
# ============================================================
set -euo pipefail

# ─── Config ─────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/qareeblak_backups"
BACKUP_FILE="qareeblak_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# Load env vars from production env file if running outside Docker
if [ -f "/srv/qareeblak/.env.production" ]; then
    set -a
    source "/srv/qareeblak/.env.production"
    set +a
fi

# Required variables (fail loudly if missing)
: "${DATABASE_URL:?ERROR: DATABASE_URL is required}"
: "${AWS_S3_BUCKET_NAME:?ERROR: AWS_S3_BUCKET_NAME is required}"
: "${AWS_REGION:?ERROR: AWS_REGION is required}"

S3_PREFIX="backups/postgres"
S3_PATH="s3://${AWS_S3_BUCKET_NAME}/${S3_PREFIX}/${BACKUP_FILE}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[$(date)] 🔄 Starting Qareeblak DB backup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Create local backup dir ────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ─── Dump database ──────────────────────────────────────────
echo "[$(date)] 📤 Dumping PostgreSQL..."
pg_dump "${DATABASE_URL}" \
    --format=custom \
    --no-acl \
    --no-owner \
    --compress=9 \
    --file="${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "[$(date)] ✅ Dump complete. Size: ${BACKUP_SIZE}"

# ─── Upload to S3 ───────────────────────────────────────────
echo "[$(date)] 📦 Uploading to S3: ${S3_PATH}"
aws s3 cp \
    "${BACKUP_DIR}/${BACKUP_FILE}" \
    "${S3_PATH}" \
    --region "${AWS_REGION}" \
    --storage-class STANDARD_IA \
    --expected-size $(stat -c%s "${BACKUP_DIR}/${BACKUP_FILE}")

echo "[$(date)] ✅ Upload complete → ${S3_PATH}"

# ─── Cleanup local file ─────────────────────────────────────
rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
echo "[$(date)] 🗑️  Local backup file removed"

# ─── Lifecycle: Prune old S3 backups beyond retention ───────
echo "[$(date)] 🔄 Pruning backups older than ${RETENTION_DAYS} days from S3..."
CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +"%Y-%m-%d")

aws s3api list-objects-v2 \
    --bucket "${AWS_S3_BUCKET_NAME}" \
    --prefix "${S3_PREFIX}/" \
    --query "Contents[?LastModified<='${CUTOFF_DATE}'].Key" \
    --output text | xargs -r -I{} aws s3 rm "s3://${AWS_S3_BUCKET_NAME}/{}"

echo "[$(date)] ✅ Old backups pruned"
echo "[$(date)] 🎉 Backup job complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
