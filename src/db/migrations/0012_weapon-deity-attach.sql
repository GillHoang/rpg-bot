-- Weapons are wielded by deities: one weapon per deity, only the pantheon
-- lead's weapon counts in battle (legacy preset weapons still fall back).
ALTER TABLE "user_weapons" ADD COLUMN "attached_deity_id" integer;--> statement-breakpoint
ALTER TABLE "user_weapons" ADD CONSTRAINT "user_weapons_attached_deity_id_fkey" FOREIGN KEY ("attached_deity_id") REFERENCES "user_deities"("user_deity_id") ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_weapons_attached_deity_id_unique" ON "user_weapons" ("attached_deity_id");
