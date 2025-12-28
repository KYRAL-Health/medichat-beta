ALTER TABLE "user_memories" ADD COLUMN "context_mode" "context_mode" DEFAULT 'patient' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_memories" ADD COLUMN "subject_patient_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_subject_patient_user_id_users_id_fk" FOREIGN KEY ("subject_patient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_memories_context_idx" ON "user_memories" USING btree ("owner_user_id","context_mode");--> statement-breakpoint
CREATE INDEX "user_memories_owner_status_ctx_subj_idx" ON "user_memories" USING btree ("owner_user_id","status","context_mode","subject_patient_user_id");