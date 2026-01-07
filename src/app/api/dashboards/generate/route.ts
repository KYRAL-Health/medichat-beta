import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { chatCompletion, getDashboardModel } from "@/server/ai";
import { db } from "@/server/db";
import {
  patientDailyDashboards,
  type PatientDailyDashboard,
} from "@/server/db/schema";
import {
  buildPatientContext,
  stringifyPatientContext,
} from "@/server/patients/context";

export const runtime = "nodejs";

const GenerateSchema = z.object({
  patientUserId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  force: z.boolean().optional(),
});

const DashboardSchema = z.object({
  overview: z.string(),
  insights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  redFlags: z.array(z.string()).default([]),
  suggestedFollowUps: z.array(z.string()).default([]),
});

function extractJson(text: string): unknown {
  const t = text.trim();
  if (t.startsWith("{") && t.endsWith("}")) return JSON.parse(t);
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(t.slice(first, last + 1));
  throw new Error("DASHBOARD_JSON_NOT_FOUND");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = GenerateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const patientUserId = parsed.data.patientUserId ?? user.id;
    if (patientUserId !== user.id) {
      await assertPatientAccess({ viewerUserId: user.id, patientUserId });
    }

    const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
    const force = parsed.data.force ?? false;

    const existing = await db.query.patientDailyDashboards.findFirst({
      where: and(
        eq(patientDailyDashboards.patientUserId, patientUserId),
        eq(patientDailyDashboards.date, date)
      ),
    });
    if (existing && !force) {
      return NextResponse.json({ ok: true, dashboard: existing });
    }

    const ctx = await buildPatientContext(patientUserId);
    const ctxText = stringifyPatientContext(ctx);

    const system = [
      "You are a medical AI assistant that aggregates and summarizes the patient's health data to generate a daily patient health dashboard.",
      "You should focus on the patient's current health status and any changes since the last dashboard.",
      "Focus on helpful insights and recommendations that the patient can use to improve their health.",
      "You must not provide medical advice; provide informational insights and encourage clinician review where appropriate.",
      "Return ONLY valid JSON with this shape:",
      JSON.stringify(
        {
          overview: "Short paragraph summary for today.",
          insights: ["Bullet insight 1", "Bullet insight 2"],
          recommendations: ["Actionable next step 1", "Actionable next step 2"],
          redFlags: [
            "If present, list urgent warning signs or thresholds to watch",
          ],
          suggestedFollowUps: ["Questions to clarify or next labs to consider"],
        },
        null,
        2
      ),
      "",
      ctxText,
    ].join("\n");

    const resp = await chatCompletion({
      model: getDashboardModel(),
      messages: [{ role: "system", content: system }],
      temperature: 0.2,
    });

    const content = resp.choices[0]?.message?.content ?? "";
    const json = extractJson(content);
    const dash = DashboardSchema.safeParse(json);
    if (!dash.success) {
      throw new Error(`DASHBOARD_SCHEMA_INVALID:${dash.error.message}`);
    }

    const saved = await db
      .insert(patientDailyDashboards)
      .values({
        patientUserId,
        date,
        model: getDashboardModel(),
        dashboardJson: dash.data,
        status: "generated",
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          patientDailyDashboards.patientUserId,
          patientDailyDashboards.date,
        ],
        set: {
          model: getDashboardModel(),
          dashboardJson: dash.data,
          status: "generated",
          createdAt: new Date(),
        },
      })
      .returning()
      .then((rows: PatientDailyDashboard[]) => rows[0]);

    return NextResponse.json({ ok: true, dashboard: saved });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "FORBIDDEN_PATIENT_ACCESS"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/dashboards/generate POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
