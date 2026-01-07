import { z } from "zod";

import { chatCompletion, getExtractModel } from "@/server/ai";

export const DocumentExtractionSchema = z.object({
  demographics: z
    .object({
      ageYears: z.number().int().min(0).max(130).optional(),
      gender: z.string().optional(),
    })
    .optional(),
  hpi: z
    .object({
      historyOfPresentIllness: z.string().optional(),
      symptomOnset: z.string().optional(),
      symptomDuration: z.string().optional(),
    })
    .optional(),
  vitals: z
    .array(
      z.object({
        measuredAt: z.string().optional(),
        systolic: z.number().optional(),
        diastolic: z.number().optional(),
        heartRate: z.number().optional(),
        temperatureC: z.number().optional(),
      })
    )
    .optional(),
  labs: z
    .array(
      z.object({
        collectedAt: z.string().optional(),
        testName: z.string(),
        valueText: z.string(),
        unit: z.string().optional(),
        referenceRange: z.string().optional(),
        flag: z.string().optional(),
      })
    )
    .optional(),
  medications: z
    .array(
      z.object({
        medicationName: z.string(),
        dose: z.string().optional(),
        frequency: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .optional(),
  conditions: z
    .array(
      z.object({
        conditionName: z.string(),
        status: z.string().optional(),
      })
    )
    .optional(),
});

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  // Try to locate the first JSON object in the text.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error("EXTRACTION_JSON_NOT_FOUND");
}

export async function extractStructuredFromDocumentText(args: {
  documentText: string;
}) {
  const maxChars = 20000;
  const input = args.documentText.length > maxChars ? args.documentText.slice(0, maxChars) : args.documentText;

  const system = [
    "You are a medical document parser.",
    "Extract structured medical information from the document text.",
    "Return ONLY valid JSON with this shape:",
    JSON.stringify(
      {
        demographics: { ageYears: 0, gender: "unknown" },
        hpi: {
          historyOfPresentIllness: "...",
          symptomOnset: "...",
          symptomDuration: "...",
        },
        vitals: [
          {
            measuredAt: "YYYY-MM-DD or ISO8601 if known",
            systolic: 120,
            diastolic: 80,
            heartRate: 72,
            temperatureC: 37,
          },
        ],
        labs: [
          {
            collectedAt: "YYYY-MM-DD or ISO8601 if known",
            testName: "HbA1c",
            valueText: "6.1",
            unit: "%",
            referenceRange: "4.0-5.6",
            flag: "high",
          },
        ],
        medications: [
          { medicationName: "Metformin", dose: "500mg", frequency: "BID", active: true },
        ],
        conditions: [{ conditionName: "Hypertension", status: "controlled" }],
      },
      null,
      2
    ),
    "If a field is unknown, omit it or use null/empty arrays.",
    "Do not add any commentary outside JSON.",
  ].join("\n");

  const resp = await chatCompletion({
    model: getExtractModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    temperature: 0,
  });

  const content = resp.choices[0]?.message?.content ?? "";
  const json = extractJsonObject(content);
  const parsed = DocumentExtractionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`EXTRACTION_SCHEMA_INVALID:${parsed.error.message}`);
  }

  return {
    model: getExtractModel(),
    extracted: parsed.data,
    raw: json,
  };
}


