CREATE TABLE "menu_action_receipts" (
	"discord_id" text NOT NULL,
	"request_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_action_receipts_discord_id_request_id_pk" PRIMARY KEY("discord_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "menu_action_receipts" ADD CONSTRAINT "menu_action_receipts_discord_id_users_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;