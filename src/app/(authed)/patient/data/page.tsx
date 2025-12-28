import { PatientDataForm } from "@/components/PatientDataForm";

export default function PatientDataPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">My data</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add your baseline history and day-to-day vitals/labs/meds/conditions.
        </p>
      </div>

      <PatientDataForm />
    </div>
  );
}


