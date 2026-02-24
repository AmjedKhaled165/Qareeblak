#!/bin/bash

# Configuration
DB_NAME="qareeblak"
DB_USER="postgres"
BACKUP_DIR="/var/backups/postgres" # Change this based on production server location
RETENTION_DAYS=7

# Load Postgres Password
source /etc/environment

# Check if directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

# Define backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

echo "======================================"
echo "Starting database backup at ${TIMESTAMP}"
echo "======================================"

# Execute the backup and gzip it to save space
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U $DB_USER -d $DB_NAME -h 127.0.0.1 | gzip > $BACKUP_FILE

# Check if the backup was successful
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ Backup successfully saved to: ${BACKUP_FILE}"
else
    echo "❌ ERROR: Database backup failed!"
    exit 1
fi

# Remove backups older than retention period
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find $BACKUP_DIR -type f -name "${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
echo "✅ Cleanup complete."
