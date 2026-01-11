CREATE TABLE "patient_profile_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"date_of_birth" date,
	"age_years" integer,
	"gender" "gender" DEFAULT 'unknown' NOT NULL,
	"history_of_present_illness" text,
	"symptom_onset" text,
	"symptom_duration" text,
	"smoking_status" "smoking_status" DEFAULT 'unknown' NOT NULL,
	"alcohol_consumption" "alcohol_consumption" DEFAULT 'unknown' NOT NULL,
	"physical_activity_level" "physical_activity_level" DEFAULT 'unknown' NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_profile_history" ADD CONSTRAINT "patient_profile_history_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_profile_history_patient_idx" ON "patient_profile_history" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "patient_profile_history_valid_from_idx" ON "patient_profile_history" USING btree ("patient_user_id","valid_from");