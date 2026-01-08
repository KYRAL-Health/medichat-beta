import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  date,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    email: text("email"), // nullable email for wallet user
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    walletAddressIdx: uniqueIndex("users_wallet_address_unique").on(
      table.walletAddress
    ),
  })
);

/**
 * Demo note:
 * This schema is intentionally pragmatic for MVP velocity (not HIPAA-grade).
 * It supports patient/physician views, invite-based access, documents, chat, dashboards, and AI memory.
 */

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("user_profiles_user_unique").on(table.userId),
  })
);

export const smokingStatusEnum = pgEnum("smoking_status", [
  "never",
  "former",
  "current",
  "unknown",
]);

export const genderEnum = pgEnum("gender", [
  "female",
  "male",
  "nonbinary",
  "other",
  "unknown",
]);

export const physicalActivityEnum = pgEnum("physical_activity_level", [
  "sedentary",
  "light",
  "moderate",
  "high",
  "unknown",
]);

export const alcoholConsumptionEnum = pgEnum("alcohol_consumption", [
  "none",
  "occasional",
  "moderate",
  "heavy",
  "unknown",
]);

export const patientProfiles = pgTable(
  "patient_profiles",
  {
    patientUserId: uuid("patient_user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    // Demographics
    dateOfBirth: date("date_of_birth"),
    // For demo convenience (optional). Prefer dateOfBirth long-term.
    ageYears: integer("age_years"),
    gender: genderEnum("gender").default("unknown").notNull(),

    // HPI / symptoms
    historyOfPresentIllness: text("history_of_present_illness"),
    symptomOnset: text("symptom_onset"),
    symptomDuration: text("symptom_duration"),

    // Lifestyle
    smokingStatus: smokingStatusEnum("smoking_status")
      .default("unknown")
      .notNull(),
    alcoholConsumption: alcoholConsumptionEnum("alcohol_consumption")
      .default("unknown")
      .notNull(),
    physicalActivityLevel: physicalActivityEnum("physical_activity_level")
      .default("unknown")
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: uniqueIndex("patient_profiles_patient_unique").on(
      table.patientUserId
    ),
  })
);

export const patientProfileHistory = pgTable(
  "patient_profile_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Demographics
    dateOfBirth: date("date_of_birth"),
    ageYears: integer("age_years"),
    gender: genderEnum("gender").default("unknown").notNull(),

    // HPI / symptoms
    historyOfPresentIllness: text("history_of_present_illness"),
    symptomOnset: text("symptom_onset"),
    symptomDuration: text("symptom_duration"),

    // Lifestyle
    smokingStatus: smokingStatusEnum("smoking_status").default("unknown").notNull(),
    alcoholConsumption: alcoholConsumptionEnum("alcohol_consumption")
      .default("unknown")
      .notNull(),
    physicalActivityLevel: physicalActivityEnum("physical_activity_level")
      .default("unknown")
      .notNull(),

    validFrom: timestamp("valid_from").defaultNow().notNull(),
    validTo: timestamp("valid_to"), // Null means current
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_profile_history_patient_idx").on(table.patientUserId),
    validFromIdx: index("patient_profile_history_valid_from_idx").on(
      table.patientUserId,
      table.validFrom
    ),
  })
);

export const patientConditions = pgTable(
  "patient_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conditionName: text("condition_name").notNull(),
    status: text("status"),
    notedAt: timestamp("noted_at").defaultNow().notNull(),
    sourceDocumentId: uuid("source_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_conditions_patient_idx").on(table.patientUserId),
  })
);

export const patientMedications = pgTable(
  "patient_medications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    medicationName: text("medication_name").notNull(),
    dose: text("dose"),
    frequency: text("frequency"),
    active: boolean("active").notNull().default(true),
    notedAt: timestamp("noted_at").defaultNow().notNull(),
    sourceDocumentId: uuid("source_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_medications_patient_idx").on(
      table.patientUserId
    ),
  })
);

export const patientVitals = pgTable(
  "patient_vitals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at").defaultNow().notNull(),
    systolic: integer("systolic"),
    diastolic: integer("diastolic"),
    heartRate: integer("heart_rate"),
    temperatureC: integer("temperature_c"),
    sourceDocumentId: uuid("source_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_vitals_patient_idx").on(table.patientUserId),
    measuredIdx: index("patient_vitals_measured_idx").on(
      table.patientUserId,
      table.measuredAt
    ),
  })
);

export const patientLabResults = pgTable(
  "patient_lab_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectedAt: timestamp("collected_at").defaultNow().notNull(),
    testName: text("test_name").notNull(),
    valueText: text("value_text").notNull(),
    valueNum: integer("value_num"),
    unit: text("unit"),
    referenceRange: text("reference_range"),
    flag: text("flag"),
    sourceDocumentId: uuid("source_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_lab_results_patient_idx").on(
      table.patientUserId
    ),
    collectedIdx: index("patient_lab_results_collected_idx").on(
      table.patientUserId,
      table.collectedAt
    ),
  })
);

export const accessInviteKindEnum = pgEnum("access_invite_kind", [
  "patientInvitesPhysician",
  "physicianInvitesPatient",
]);

export const patientPhysicianAccess = pgTable(
  "patient_physician_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    physicianUserId: uuid("physician_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    patientIdx: index("patient_physician_access_patient_idx").on(
      table.patientUserId
    ),
    physicianIdx: index("patient_physician_access_physician_idx").on(
      table.physicianUserId
    ),
    uniquePair: uniqueIndex("patient_physician_access_pair_unique").on(
      table.patientUserId,
      table.physicianUserId
    ),
  })
);

export const accessInvites = pgTable(
  "access_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: accessInviteKindEnum("kind").notNull(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    acceptedAt: timestamp("accepted_at"),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    inviterIdx: index("access_invites_inviter_idx").on(table.inviterUserId),
    tokenUnique: uniqueIndex("access_invites_token_hash_unique").on(
      table.tokenHash
    ),
    kindIdx: index("access_invites_kind_idx").on(table.kind),
  })
);

export const documentStatusEnum = pgEnum("document_status", [
  "uploaded",
  "parsed",
  "error",
]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalFileName: text("original_file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    bucket: text("bucket"),
    objectKey: text("object_key"),
    status: documentStatusEnum("status").notNull().default("uploaded"),
    parsedAt: timestamp("parsed_at"),
    parseError: text("parse_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("documents_patient_idx").on(table.patientUserId),
    uploadedByIdx: index("documents_uploaded_by_idx").on(
      table.uploadedByUserId
    ),
  })
);

export const documentText = pgTable(
  "document_text",
  {
    documentId: uuid("document_id")
      .primaryKey()
      .references(() => documents.id, { onDelete: "cascade" }),
    extractedText: text("extracted_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    docUnique: uniqueIndex("document_text_document_unique").on(
      table.documentId
    ),
  })
);

export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    extractedJson: jsonb("extracted_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    docIdx: index("document_extractions_document_idx").on(table.documentId),
  })
);

export const dashboardStatusEnum = pgEnum("dashboard_status", [
  "generated",
  "error",
]);

export const patientDailyDashboards = pgTable(
  "patient_daily_dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    model: text("model").notNull(),
    dashboardJson: jsonb("dashboard_json").notNull(),
    status: dashboardStatusEnum("status").notNull().default("generated"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_daily_dashboards_patient_idx").on(
      table.patientUserId
    ),
    uniqueDay: uniqueIndex("patient_daily_dashboards_unique_day").on(
      table.patientUserId,
      table.date
    ),
  })
);

export const contextModeEnum = pgEnum("context_mode", ["patient", "physician"]);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contextMode: contextModeEnum("context_mode").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("chat_threads_patient_idx").on(table.patientUserId),
    createdByIdx: index("chat_threads_created_by_idx").on(
      table.createdByUserId
    ),
  })
);

export const senderRoleEnum = pgEnum("sender_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    senderRole: senderRoleEnum("sender_role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    threadIdx: index("chat_messages_thread_idx").on(table.threadId),
    createdIdx: index("chat_messages_created_idx").on(
      table.threadId,
      table.createdAt
    ),
  })
);

export const memoryStatusEnum = pgEnum("memory_status", [
  "proposed",
  "accepted",
  "rejected",
]);

export const userMemories = pgTable(
  "user_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Scope memories so patient/physician contexts don't bleed together.
    // For physician-mode memories, `subjectPatientUserId` is the patient being discussed.
    contextMode: contextModeEnum("context_mode").notNull().default("patient"),
    subjectPatientUserId: uuid("subject_patient_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      }
    ),
    status: memoryStatusEnum("status").notNull().default("proposed"),
    memoryText: text("memory_text").notNull(),
    category: text("category"),
    sourceThreadId: uuid("source_thread_id").references(() => chatThreads.id, {
      onDelete: "set null",
    }),
    sourceMessageId: uuid("source_message_id").references(
      () => chatMessages.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    rejectedAt: timestamp("rejected_at"),
  },
  (table) => ({
    ownerIdx: index("user_memories_owner_idx").on(table.ownerUserId),
    statusIdx: index("user_memories_status_idx").on(
      table.ownerUserId,
      table.status
    ),
    contextIdx: index("user_memories_context_idx").on(
      table.ownerUserId,
      table.contextMode
    ),
    ownerStatusCtxSubjectIdx: index(
      "user_memories_owner_status_ctx_subj_idx"
    ).on(
      table.ownerUserId,
      table.status,
      table.contextMode,
      table.subjectPatientUserId
    ),
  })
);

export const recordSuggestionKindEnum = pgEnum("record_suggestion_kind", [
  "profile_update",
  "vital",
  "lab",
  "medication",
  "condition",
]);

export const recordSuggestionStatusEnum = pgEnum("record_suggestion_status", [
  "proposed",
  "accepted",
  "rejected",
]);

export const patientRecordSuggestions = pgTable(
  "patient_record_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: recordSuggestionKindEnum("kind").notNull(),
    summaryText: text("summary_text").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    status: recordSuggestionStatusEnum("status").notNull().default("proposed"),
    sourceThreadId: uuid("source_thread_id").references(() => chatThreads.id, {
      onDelete: "set null",
    }),
    sourceMessageId: uuid("source_message_id").references(
      () => chatMessages.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_record_suggestions_patient_idx").on(
      table.patientUserId
    ),
    statusIdx: index("patient_record_suggestions_status_idx").on(
      table.patientUserId,
      table.status
    ),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  patientProfile: one(patientProfiles, {
    fields: [users.id],
    references: [patientProfiles.patientUserId],
  }),
  conditions: many(patientConditions),
  medications: many(patientMedications),
  vitals: many(patientVitals),
  labs: many(patientLabResults),
  documents: many(documents),
  recordSuggestions: many(patientRecordSuggestions),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const patientProfilesRelations = relations(
  patientProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [patientProfiles.patientUserId],
      references: [users.id],
    }),
    history: many(patientProfileHistory),
  })
);

export const patientProfileHistoryRelations = relations(
  patientProfileHistory,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientProfileHistory.patientUserId],
      references: [users.id],
    }),
  })
);

export const patientConditionsRelations = relations(
  patientConditions,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientConditions.patientUserId],
      references: [users.id],
    }),
  })
);

export const patientMedicationsRelations = relations(
  patientMedications,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientMedications.patientUserId],
      references: [users.id],
    }),
  })
);

export const patientVitalsRelations = relations(patientVitals, ({ one }) => ({
  patient: one(users, {
    fields: [patientVitals.patientUserId],
    references: [users.id],
  }),
}));

export const patientLabResultsRelations = relations(
  patientLabResults,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientLabResults.patientUserId],
      references: [users.id],
    }),
  })
);

export const patientPhysicianAccessRelations = relations(
  patientPhysicianAccess,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientPhysicianAccess.patientUserId],
      references: [users.id],
    }),
    physician: one(users, {
      fields: [patientPhysicianAccess.physicianUserId],
      references: [users.id],
    }),
  })
);

export const accessInvitesRelations = relations(accessInvites, ({ one }) => ({
  inviter: one(users, {
    fields: [accessInvites.inviterUserId],
    references: [users.id],
  }),
  acceptedBy: one(users, {
    fields: [accessInvites.acceptedByUserId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  patient: one(users, {
    fields: [documents.patientUserId],
    references: [users.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedByUserId],
    references: [users.id],
  }),
}));

export const documentTextRelations = relations(documentText, ({ one }) => ({
  document: one(documents, {
    fields: [documentText.documentId],
    references: [documents.id],
  }),
}));

export const documentExtractionsRelations = relations(
  documentExtractions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentExtractions.documentId],
      references: [documents.id],
    }),
  })
);

export const patientDailyDashboardsRelations = relations(
  patientDailyDashboards,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientDailyDashboards.patientUserId],
      references: [users.id],
    }),
  })
);

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  patient: one(users, {
    fields: [chatThreads.patientUserId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [chatThreads.createdByUserId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id],
  }),
}));

export const userMemoriesRelations = relations(userMemories, ({ one }) => ({
  owner: one(users, {
    fields: [userMemories.ownerUserId],
    references: [users.id],
  }),
  thread: one(chatThreads, {
    fields: [userMemories.sourceThreadId],
    references: [chatThreads.id],
  }),
  message: one(chatMessages, {
    fields: [userMemories.sourceMessageId],
    references: [chatMessages.id],
  }),
}));

export const patientRecordSuggestionsRelations = relations(
  patientRecordSuggestions,
  ({ one }) => ({
    patient: one(users, {
      fields: [patientRecordSuggestions.patientUserId],
      references: [users.id],
    }),
    thread: one(chatThreads, {
      fields: [patientRecordSuggestions.sourceThreadId],
      references: [chatThreads.id],
    }),
    message: one(chatMessages, {
      fields: [patientRecordSuggestions.sourceMessageId],
      references: [chatMessages.id],
    }),
  })
);

export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type PatientVital = typeof patientVitals.$inferSelect;
export type PatientLabResult = typeof patientLabResults.$inferSelect;
export type PatientMedication = typeof patientMedications.$inferSelect;
export type PatientCondition = typeof patientConditions.$inferSelect;
export type PatientPhysicianAccess = typeof patientPhysicianAccess.$inferSelect;
export type AccessInvite = typeof accessInvites.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentText = typeof documentText.$inferSelect;
export type DocumentExtraction = typeof documentExtractions.$inferSelect;
export type PatientDailyDashboard = typeof patientDailyDashboards.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserMemory = typeof userMemories.$inferSelect;
export type PatientRecordSuggestion =
  typeof patientRecordSuggestions.$inferSelect;
