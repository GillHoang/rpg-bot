-- OwO-style weapon parity: per-drop quality grade + weapon-shard currency.
ALTER TABLE "user_weapons" ADD COLUMN "quality" text DEFAULT 'Common' NOT NULL;--> statement-breakpoint
ALTER TABLE "users_bag" ADD COLUMN "weapon_shards" integer DEFAULT 0 NOT NULL;
