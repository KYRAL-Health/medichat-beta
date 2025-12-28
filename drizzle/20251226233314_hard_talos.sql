CREATE TYPE "public"."access_invite_kind" AS ENUM('patientInvitesPhysician', 'physicianInvitesPatient');--> statement-breakpoint
CREATE TYPE "public"."alcohol_consumption" AS ENUM('none', 'occasional', 'moderate', 'heavy', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."context_mode" AS ENUM('patient', 'physician');--> statement-breakpoint
CREATE TYPE "public"."dashboard_status" AS ENUM('generated', 'error');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'parsed', 'error');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'nonbinary', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('proposed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."physical_activity_level" AS ENUM('sedentary', 'light', 'moderate', 'high', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."sender_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TYPE "public"."smoking_status" AS ENUM('never', 'former', 'current', 'unknown');--> statement-breakpoint
CREATE TABLE "access_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "access_invite_kind" NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"accepted_at" timestamp,
	"accepted_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_role" "sender_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"context_mode" "context_mode" NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"model" text NOT NULL,
	"extracted_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_text" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"extracted_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"original_file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "document_status" DEFAULT 'uploaded' NOT NULL,
	"parsed_at" timestamp,
	"parse_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"condition_name" text NOT NULL,
	"status" text,
	"noted_at" timestamp DEFAULT now() NOT NULL,
	"source_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_daily_dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"model" text NOT NULL,
	"dashboard_json" jsonb NOT NULL,
	"status" "dashboard_status" DEFAULT 'generated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_lab_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"test_name" text NOT NULL,
	"value_text" text NOT NULL,
	"value_num" integer,
	"unit" text,
	"reference_range" text,
	"flag" text,
	"source_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"medication_name" text NOT NULL,
	"dose" text,
	"frequency" text,
	"active" boolean DEFAULT true NOT NULL,
	"noted_at" timestamp DEFAULT now() NOT NULL,
	"source_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_physician_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"physician_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "patient_profiles" (
	"patient_user_id" uuid PRIMARY KEY NOT NULL,
	"date_of_birth" date,
	"age_years" integer,
	"gender" "gender" DEFAULT 'unknown' NOT NULL,
	"history_of_present_illness" text,
	"symptom_onset" text,
	"symptom_duration" text,
	"smoking_status" "smoking_status" DEFAULT 'unknown' NOT NULL,
	"alcohol_consumption" "alcohol_consumption" DEFAULT 'unknown' NOT NULL,
	"physical_activity_level" "physical_activity_level" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"measured_at" timestamp DEFAULT now() NOT NULL,
	"systolic" integer,
	"diastolic" integer,
	"heart_rate" integer,
	"temperature_c" integer,
	"source_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "memory_status" DEFAULT 'proposed' NOT NULL,
	"memory_text" text NOT NULL,
	"category" text,
	"source_thread_id" uuid,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"rejected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_invites" ADD CONSTRAINT "access_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_invites" ADD CONSTRAINT "access_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_text" ADD CONSTRAINT "document_text_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_conditions" ADD CONSTRAINT "patient_conditions_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_daily_dashboards" ADD CONSTRAINT "patient_daily_dashboards_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_lab_results" ADD CONSTRAINT "patient_lab_results_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ADD CONSTRAINT "patient_physician_access_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_physician_access" ADD CONSTRAINT "patient_physician_access_physician_user_id_users_id_fk" FOREIGN KEY ("physician_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_vitals" ADD CONSTRAINT "patient_vitals_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_source_thread_id_chat_threads_id_fk" FOREIGN KEY ("source_thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_source_message_id_chat_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_invites_inviter_idx" ON "access_invites" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_invites_token_hash_unique" ON "access_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "access_invites_kind_idx" ON "access_invites" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "chat_messages_thread_idx" ON "chat_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_idx" ON "chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_threads_patient_idx" ON "chat_threads" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "chat_threads_created_by_idx" ON "chat_threads" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "document_extractions_document_idx" ON "document_extractions" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_text_document_unique" ON "document_text" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_patient_idx" ON "documents" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "documents_uploaded_by_idx" ON "documents" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "patient_conditions_patient_idx" ON "patient_conditions" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_daily_dashboards_patient_idx" ON "patient_daily_dashboards" USING btree ("patient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_daily_dashboards_unique_day" ON "patient_daily_dashboards" USING btree ("patient_user_id","date");--> statement-breakpoint
CREATE INDEX "patient_lab_results_patient_idx" ON "patient_lab_results" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_lab_results_collected_idx" ON "patient_lab_results" USING btree ("patient_user_id","collected_at");--> statement-breakpoint
CREATE INDEX "patient_medications_patient_idx" ON "patient_medications" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_physician_access_patient_idx" ON "patient_physician_access" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_physician_access_physician_idx" ON "patient_physician_access" USING btree ("physician_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_physician_access_pair_unique" ON "patient_physician_access" USING btree ("patient_user_id","physician_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_profiles_patient_unique" ON "patient_profiles" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_vitals_patient_idx" ON "patient_vitals" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_vitals_measured_idx" ON "patient_vitals" USING btree ("patient_user_id","measured_at");--> statement-breakpoint
CREATE INDEX "user_memories_owner_idx" ON "user_memories" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "user_memories_status_idx" ON "user_memories" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_address_unique" ON "users" USING btree ("wallet_address");