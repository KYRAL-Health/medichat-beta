import Link from "next/link";
import { DocumentManager } from "@/components/DocumentManager";

export default function PatientDocumentsPage() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload PDFs/lab reports here. The backend will extract text and ask the model to
          normalize vitals/labs/meds/conditions into your record.
        </p>
      </div>

      <DocumentManager />

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Tip: after parsing, check your{" "}
        <Link className="underline" href="/patient/dashboard">
          Dashboard
        </Link>{" "}
        to see extracted labs/vitals.
      </p>
    </div>
  );
}


