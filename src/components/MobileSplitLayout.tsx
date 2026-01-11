"use client";

import { useState } from "react";

export function MobileSplitLayout({
  children, // Chat pane (usually)
  dashboard, // Dashboard pane
}: {
  children: React.ReactNode;
  dashboard: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "dashboard">("chat");

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 overflow-hidden relative">
      {/* Mobile Tabs */}
      <div className="md:hidden flex shrink-0 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 bg-zinc-50 dark:bg-black">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === "chat"
              ? "text-zinc-900 border-b-2 border-zinc-900 dark:text-zinc-100 dark:border-zinc-100"
              : "text-zinc-500 dark:text-zinc-500"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === "dashboard"
              ? "text-zinc-900 border-b-2 border-zinc-900 dark:text-zinc-100 dark:border-zinc-100"
              : "text-zinc-500 dark:text-zinc-500"
          }`}
        >
          Overview
        </button>
      </div>

      {/* Chat Pane */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${
          activeTab === "chat" ? "flex" : "hidden md:flex"
        }`}
      >
        {children}
      </div>

      {/* Dashboard Pane */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col gap-4 h-full overflow-y-auto pb-4 shrink-0 border-l border-zinc-100 pl-0 md:pl-6 dark:border-zinc-900 ${
          activeTab === "dashboard" ? "flex" : "hidden md:flex"
        }`}
      >
        {dashboard}
      </div>
    </div>
  );
}

