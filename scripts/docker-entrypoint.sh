#!/bin/sh
# Khởi động container bot: migrate → seed → deploy slash commands → chạy bot.
# Mỗi bước dừng cả container nếu lỗi để không chạy bot trên DB cũ / lệnh lệch.
set -e

echo "[entrypoint] applying migrations..."
node dist/db/migrate.js

echo "[entrypoint] seeding catalogs (idempotent upsert)..."
node dist/seed/seed.js

echo "[entrypoint] deploying slash commands..."
npm run undeploy:commands:guild 1544564663281385512

echo "[entrypoint] starting bot..."
exec node dist/index.js
