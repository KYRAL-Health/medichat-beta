import { Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

/**
 * Gemini Live API tool declarations — equivalent to the OpenAI tools in
 * src/app/api/chat/route.ts but in Gemini's functionDeclarations format.
 *
 * The actual tool *execution* lives in voiceProxy.ts (reusing the existing
 * DB access functions from tools.ts / patientTools.ts).
 */

export const liveFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "retrieveMemories",
    description:
      "Fetch relevant accepted memories for the current authenticated user to personalize responses.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: "Maximum number of memories to return (1-50).",
        },
      },
    },
  },
  {
    name: "logMemory",
    description:
      "Propose a memory worth remembering about the user to personalize future responses. The user must confirm later.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        memoryText: {
          type: Type.STRING,
          description: "The text of the memory to remember (1-500 chars).",
        },
        category: {
          type: Type.STRING,
          description: "Optional category tag for the memory (max 50 chars).",
        },
      },
      required: ["memoryText"],
    },
  },
  {
    name: "getDocumentInsights",
    description:
      "Read insights and extracted data from a specific document attached to this conversation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        documentId: {
          type: Type.STRING,
          description: "The UUID of the document to read.",
        },
      },
      required: ["documentId"],
    },
  },
  {
    name: "proposePatientRecordSuggestion",
    description:
      "Propose a structured update to the patient's record (vitals, labs, medications, conditions, or profile).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        kind: {
          type: Type.STRING,
          enum: ["profile_update", "vital", "lab", "medication", "condition"],
          description: "The type of record update.",
        },
        summaryText: {
          type: Type.STRING,
          description:
            "Human readable summary of what is being changed/added.",
        },
        payloadJson: {
          type: Type.OBJECT,
          description: [
            "The structured data for the update. Required fields per kind:",
            "- profile_update: any subset of { dateOfBirth, biologicalSex, heightCm, weightKg, bloodType, allergies, emergencyContactName, emergencyContactPhone }",
            "- vital: { measuredAt? (ISO8601), systolic?, diastolic?, heartRate?, temperatureC? }",
            "- lab: { testName (required), valueText (required), valueNum?, unit?, referenceRange?, flag?, collectedAt? (ISO8601) }",
            "- medication: { medicationName (required), dose?, frequency?, active? }",
            "- condition: { conditionName (required), status? (e.g. 'active'|'resolved'|'chronic') }",
          ].join(" "),
        },
      },
      required: ["kind", "summaryText", "payloadJson"],
    },
  },
];
