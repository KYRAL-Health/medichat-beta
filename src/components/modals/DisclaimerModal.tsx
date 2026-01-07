"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingDots } from "@/components/LoadingDots";

export function DisclaimerModal({ 
  open, 
  onAccept 
}: { 
  open: boolean; 
  onAccept: () => Promise<void>;
}) {
  const [accepting, setAccepting] = useState(false);

  if (!open) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept();
    } catch (error) {
      console.error("Failed to accept disclaimer", error);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Medical AI Waiver & Disclaimer
          </h2>
        </div>
        
        <div className="flex-1 p-8 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950/50 text-center gap-4 min-h-[200px]">
          <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
            Before using MediChat, you must read and accept the Medical AI Waiver & Disclaimer.
          </p>
          <a 
            href="/files/Medichat_Medical_AI_Waiver.pdf" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:no-underline font-medium"
          >
            Open Medical AI Waiver & Disclaimer (PDF)
          </a>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3 items-center">
            <p className="text-sm text-zinc-500 mr-auto">
                Please review the full disclaimer before proceeding.
            </p>
            <button
                onClick={handleAccept}
                disabled={accepting}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
                {accepting ? (
                    <>
                        <span>Accepting...</span>
                        <LoadingDots />
                    </>
                ) : (
                    "I Accept"
                )}
            </button>
        </div>
      </div>
    </div>
  );
}
