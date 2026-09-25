#!/bin/sh
# Khởi động container bot: đợi DB → migrate → seed → deploy slash commands → chạy bot.
# Mỗi bước dừng cả container nếu lỗi để không chạy bot trên DB cũ / lệnh lệch.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required (see .env.example)}"

# Postgres external có thể chưa nhận connection ngay khi bot start (reboot
# cùng lúc): retry migrate tối đa ~60s thay vì crashloop rồi restart container.
echo "[entrypoint] applying migrations (with retry)..."
tries=0
until node dist/db/migrate.js; do
	tries=$((tries + 1))
	if [ "$tries" -ge 30 ]; then
		echo "[entrypoint] migrations failed after 30 attempts, giving up." >&2
		exit 1
	fi
	echo "[entrypoint] migrate failed, retrying in 2s (attempt $tries/30)..." >&2
	sleep 2
done

echo "[entrypoint] seeding catalogs (idempotent upsert)..."
node dist/seed/seed.js

# Deploy global PUT mỗi lần boot vừa chậm vừa dễ ăn rate-limit Discord:
# đặt SKIP_DEPLOY=1 khi lệnh không đổi (migrate/seed vẫn chạy bình thường).
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
	echo "[entrypoint] skipping slash-command deploy (SKIP_DEPLOY=1)..."
else
	echo "[entrypoint] deploying slash commands..."
	node dist/scripts/deployCommands.js
fi

echo "[entrypoint] starting bot..."
exec node dist/index.js
