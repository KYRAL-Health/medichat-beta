"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <Link href="/">
            <Button variant="outline">Back to App</Button>
          </Link>
        </div>
        
        <div className="prose dark:prose-invert max-w-none space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>Last updated: January 11, 2026</p>
          
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">1. Acceptance of Terms</h2>
          <p>
            By accessing and using MediChat Assistant, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use our service.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">2. Medical Disclaimer</h2>
          <p>
            MediChat Assistant is an AI-powered tool designed to assist with health information management.
            It is NOT a substitute for professional medical advice, diagnosis, or treatment.
            Always seek the advice of your physician or other qualified health provider with any questions
            you may have regarding a medical condition.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">3. Use of Service</h2>
          <p>
            You agree to use this service only for lawful purposes and in accordance with these Terms.
            You are responsible for maintaining the confidentiality of your account credentials.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">4. Data Privacy</h2>
          <p>
            Your use of the service is also governed by our Privacy Policy. We are committed to protecting
            your personal health information.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6">5. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of any material
            changes to these terms.
          </p>
        </div>
      </div>
    </div>
  );
}

