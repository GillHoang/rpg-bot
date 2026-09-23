CREATE TABLE "donation_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_code" text NOT NULL,
	"tier_id" text,
	"request_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sepay_transaction_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "donation_orders_payment_code_unique" UNIQUE("payment_code"),
	CONSTRAINT "donation_orders_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "donation_orders_sepay_transaction_unique" UNIQUE("sepay_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "donation_webhook_receipts" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"provider_event_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"order_id" text,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "donation_webhook_provider_event_unique" UNIQUE("provider_event_id"),
	CONSTRAINT "donation_webhook_transaction_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "donation_provisioning_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "donation_provisioning_order_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "donation_grant_receipts" (
	"operation_id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"grant_id" text,
	"subject" text NOT NULL,
	"plan_slug" text NOT NULL,
	"expires_at" timestamp,
	"entitlements" jsonb NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "donation_grant_receipts_order_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "donation_webhook_receipts" ADD CONSTRAINT "donation_webhook_receipts_order_id_donation_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."donation_orders"("order_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "donation_provisioning_jobs" ADD CONSTRAINT "donation_provisioning_jobs_order_id_donation_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."donation_orders"("order_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "donation_grant_receipts" ADD CONSTRAINT "donation_grant_receipts_order_id_donation_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."donation_orders"("order_id") ON DELETE no action ON UPDATE no action;
