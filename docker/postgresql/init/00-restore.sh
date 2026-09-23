#!/bin/bash
set -e

DUMP=/docker-entrypoint-initdb.d/footballGTO.sql

if [ ! -f "$DUMP" ]; then
    echo "⚠️  Дамп $DUMP не найден — пропускаю восстановление"
    exit 0
fi

echo "🔧 Восстанавливаю дамп $DUMP в БД $POSTGRES_DB..."

# plain SQL → psql, custom → pg_restore
if head -c 5 "$DUMP" | grep -q "PGDMP"; then
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --no-owner --no-acl --clean --if-exists \
        "$DUMP"
else
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$DUMP"
fi

echo "✅ Дамп восстановлен"