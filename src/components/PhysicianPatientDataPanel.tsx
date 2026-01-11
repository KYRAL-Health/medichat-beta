"use client";

import { useState } from "react";
import { PhysicianPatientDataEntry } from "@/components/PhysicianPatientDataEntry";
import { PatientHistoryTimeline } from "@/components/PatientHistoryTimeline";
import { DocumentManager } from "@/components/DocumentManager";

export function PhysicianPatientDataPanel({ patientUserId }: { patientUserId: string }) {
  const [activeTab, setActiveTab] = useState<"entry" | "history" | "documents">("entry");

  return (
    <div className="space-y-4">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab("entry")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "entry"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Add Data
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "documents"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          History Timeline
        </button>
      </div>

      {activeTab === "entry" && (
        <PhysicianPatientDataEntry patientUserId={patientUserId} />
      )}
      
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 sm:p-4">
           <DocumentManager patientUserId={patientUserId} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
           <PatientHistoryTimeline patientUserId={patientUserId} />
        </div>
      )}
    </div>
  );
}

