import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { canAccessPatient } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import {
  patientProfileHistory,
  patientVitals,
  patientLabResults,
  patientMedications,
  patientConditions,
  documents,
} from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const searchParams = req.nextUrl.searchParams;
    const requestedPatientId = searchParams.get("patientUserId");

    // Default to self if not specified
    let targetUserId = user.id;

    // If requesting another patient, verify access
    if (requestedPatientId && requestedPatientId !== user.id) {
      const hasAccess = await canAccessPatient({
        viewerUserId: user.id,
        patientUserId: requestedPatientId,
      });

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      targetUserId = requestedPatientId;
    }

    // Fetch all types of records
    const [
      profileHistory,
      vitals,
      labs,
      meds,
      conditions,
      docs
    ] = await Promise.all([
      db.query.patientProfileHistory.findMany({
        where: eq(patientProfileHistory.patientUserId, targetUserId),
        orderBy: [desc(patientProfileHistory.validFrom)],
      }),
      db.query.patientVitals.findMany({
        where: eq(patientVitals.patientUserId, targetUserId),
        orderBy: [desc(patientVitals.measuredAt)],
      }),
      db.query.patientLabResults.findMany({
        where: eq(patientLabResults.patientUserId, targetUserId),
        orderBy: [desc(patientLabResults.collectedAt)],
      }),
      db.query.patientMedications.findMany({
        where: eq(patientMedications.patientUserId, targetUserId),
        orderBy: [desc(patientMedications.notedAt)],
      }),
      db.query.patientConditions.findMany({
        where: eq(patientConditions.patientUserId, targetUserId),
        orderBy: [desc(patientConditions.notedAt)],
      }),
      db.query.documents.findMany({
        where: eq(documents.patientUserId, targetUserId),
        orderBy: [desc(documents.createdAt)],
      }),
    ]);

    // Combine and sort by date
    const history = [
      ...profileHistory.map(h => ({ type: 'profile', date: h.validFrom, data: h })),
      ...vitals.map(v => ({ type: 'vital', date: v.measuredAt, data: v })),
      ...labs.map(l => ({ type: 'lab', date: l.collectedAt, data: l })),
      ...meds.map(m => ({ type: 'medication', date: m.notedAt, data: m })),
      ...conditions.map(c => ({ type: 'condition', date: c.notedAt, data: c })),
      ...docs.map(d => ({ type: 'document', date: d.createdAt, data: d })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("/api/patient/history GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

