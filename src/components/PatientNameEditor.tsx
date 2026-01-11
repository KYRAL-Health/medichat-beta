"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/Input";

export function PatientNameEditor({
  patientUserId,
  initialName,
}: {
  patientUserId: string;
  initialName: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientUserId}/identity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      setIsEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-lg font-semibold w-full max-w-[300px]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          placeholder="Your Name"
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="text-xs bg-zinc-900 text-white dark:bg-white dark:text-black px-2 py-1 rounded disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          disabled={saving}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 px-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1 className="text-xl font-semibold">
        {initialName ? `Hello, ${initialName}` : "Hello, patient"}
      </h1>
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        title="Edit your name"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    </div>
  );
}

