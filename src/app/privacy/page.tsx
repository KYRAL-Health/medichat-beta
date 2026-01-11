"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <Link href="/">
            <Button variant="outline">Back to App</Button>
          </Link>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>Last updated: January 11, 2026</p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">
            1. Information We Collect
          </h2>
          <p>
            We collect information you provide directly to us, including account
            information, health data you input, and documents you upload.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">
            2. How We Use Your Information
          </h2>
          <p>
            We use your information to provide, maintain, and improve our
            services. We do NOT use your personal health data to train our AI
            models. We do NOT sell your personal data to third parties.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">
            3. Data Security
          </h2>
          <p>
            We implement appropriate technical and organizational measures to
            protect your personal information against unauthorized access,
            alteration, disclosure, or destruction.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">
            4. Data Retention
          </h2>
          <p>
            We retain your personal information only for as long as necessary to
            provide the Service and fulfill the purposes described in this
            policy.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">
            5. Your Rights
          </h2>
          <p>
            You have the right to access, correct, or delete your personal
            information. You can manage your data directly within the
            application.
          </p>
        </div>
      </div>
    </div>
  );
}
