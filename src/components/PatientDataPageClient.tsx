"use client";

import { useState } from "react";
import { PatientDataForm } from "@/components/PatientDataForm";
import { PatientHistoryTimeline } from "@/components/PatientHistoryTimeline";

export function PatientDataPageClient({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"entry" | "history">("entry");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">My data</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manage your health records and view your history.
        </p>
      </div>

      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("entry")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "entry"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Data Entry
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          History Timeline
        </button>
      </div>

      {activeTab === "entry" ? (
        <PatientDataForm
          patientUserId={userId}
          initialName={initialName}
        />
      ) : (
        <div className="max-w-2xl">
          <PatientHistoryTimeline />
        </div>
      )}
    </div>
  );
}

