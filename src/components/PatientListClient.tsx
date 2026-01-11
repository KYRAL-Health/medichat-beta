"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PatientListClient({
  patients,
}: {
  patients: Array<{
    patientUserId: string;
    walletAddress: string;
    displayName: string | null;
    ageYears: number | null;
    gender: string | null;
    overview: string | null;
  }>;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveName = async (patientUserId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientUserId}/identity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName }),
      });
      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!patients.length) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
          <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium">No patients found</h3>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          Get started by inviting a patient or asking them to share their invite link with you.
        </p>
        <Link href="/physician/invites">
          <Button variant="outline" className="mt-2">
            Manage Invites
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {patients.map((p) => (
        <div
          key={p.patientUserId}
          className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-all hover:shadow-md dark:hover:border-zinc-700"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              {editingId === p.patientUserId ? (
                <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveName(p.patientUserId);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); void saveName(p.patientUserId); }} disabled={saving}>
                    Save
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/name">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate" title={p.displayName || "Unnamed Patient"}>
                    {p.displayName || "Unnamed Patient"}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startEdit(p.patientUserId, p.displayName || "");
                    }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-opacity"
                    title="Edit name"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="text-xs text-zinc-500 font-mono truncate mt-0.5">
                {p.walletAddress}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
            <span className="bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">
              {p.ageYears ? `${p.ageYears} yrs` : "Age —"}
            </span>
            <span className="bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded capitalize">
              {p.gender ?? "Gender —"}
            </span>
          </div>

          <div className="flex-1 min-h-[3em]">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
              {p.overview || "No AI overview available for today."}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
            <Link href={`/physician/patients/${p.patientUserId}`} className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                    View Record
                </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}


