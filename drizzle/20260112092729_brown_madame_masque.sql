CREATE TYPE "public"."usage_kind" AS ENUM('chat');--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"kind" "usage_kind" DEFAULT 'chat' NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"tokens" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_emails" (
	"email" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_invites" DROP CONSTRAINT "access_invites_inviter_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "access_invites" DROP CONSTRAINT "access_invites_accepted_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_threads" DROP CONSTRAINT "chat_threads_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_threads" DROP CONSTRAINT "chat_threads_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_uploaded_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_conditions" DROP CONSTRAINT "patient_conditions_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_daily_dashboards" DROP CONSTRAINT "patient_daily_dashboards_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_lab_results" DROP CONSTRAINT "patient_lab_results_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_medications" DROP CONSTRAINT "patient_medications_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_physician_access" DROP CONSTRAINT "patient_physician_access_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_physician_access" DROP CONSTRAINT "patient_physician_access_physician_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_profile_history" DROP CONSTRAINT "patient_profile_history_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP CONSTRAINT "patient_profiles_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" DROP CONSTRAINT "patient_record_suggestions_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_vitals" DROP CONSTRAINT "patient_vitals_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_memories" DROP CONSTRAINT "user_memories_owner_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_memories" DROP CONSTRAINT "user_memories_subject_patient_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "users_wallet_address_unique";--> statement-breakpoint
ALTER TABLE "access_invites" ALTER COLUMN "inviter_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "access_invites" ALTER COLUMN "accepted_by_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat_threads" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat_threads" ALTER COLUMN "created_by_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "uploaded_by_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_conditions" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_daily_dashboards" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_lab_results" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_medications" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ALTER COLUMN "physician_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_profile_history" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_profiles" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "patient_vitals" ALTER COLUMN "patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_memories" ALTER COLUMN "owner_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_memories" ALTER COLUMN "subject_patient_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_user_id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_users_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_logs_user_idx" ON "usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_logs_thread_idx" ON "usage_logs" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "usage_logs_created_idx" ON "usage_logs" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "access_invites" ADD CONSTRAINT "access_invites_inviter_user_id_users_clerk_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_invites" ADD CONSTRAINT "access_invites_accepted_by_user_id_users_clerk_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_user_id_users_clerk_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_clerk_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_conditions" ADD CONSTRAINT "patient_conditions_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_daily_dashboards" ADD CONSTRAINT "patient_daily_dashboards_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_lab_results" ADD CONSTRAINT "patient_lab_results_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ADD CONSTRAINT "patient_physician_access_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ADD CONSTRAINT "patient_physician_access_physician_user_id_users_clerk_user_id_fk" FOREIGN KEY ("physician_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profile_history" ADD CONSTRAINT "patient_profile_history_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" ADD CONSTRAINT "patient_record_suggestions_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_vitals" ADD CONSTRAINT "patient_vitals_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_owner_user_id_users_clerk_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_subject_patient_user_id_users_clerk_user_id_fk" FOREIGN KEY ("subject_patient_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "wallet_address";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email";