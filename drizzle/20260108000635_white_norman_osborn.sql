CREATE TYPE "public"."record_suggestion_kind" AS ENUM('profile_update', 'vital', 'lab', 'medication', 'condition');--> statement-breakpoint
CREATE TYPE "public"."record_suggestion_status" AS ENUM('proposed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "patient_record_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"kind" "record_suggestion_kind" NOT NULL,
	"summary_text" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" "record_suggestion_status" DEFAULT 'proposed' NOT NULL,
	"source_thread_id" uuid,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" ADD CONSTRAINT "patient_record_suggestions_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" ADD CONSTRAINT "patient_record_suggestions_source_thread_id_chat_threads_id_fk" FOREIGN KEY ("source_thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_record_suggestions" ADD CONSTRAINT "patient_record_suggestions_source_message_id_chat_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_record_suggestions_patient_idx" ON "patient_record_suggestions" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_record_suggestions_status_idx" ON "patient_record_suggestions" USING btree ("patient_user_id","status");