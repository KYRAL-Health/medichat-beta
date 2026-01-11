"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function DisclaimerModal({
  open,
  onAccept,
}: {
  open: boolean;
  onAccept: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Important Privacy & Safety Notice</h2>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3 text-sm">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Key Privacy Commitments:
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-200">
                    We do NOT use your health data to train AI models.
                  </strong>
                </li>
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-200">
                    We do NOT sell your personal data.
                  </strong>
                </li>
                <li>
                  This service is for informational purposes only and is not a
                  substitute for professional medical advice.
                </li>
                <li>
                  In case of emergency, call 911 immediately. Do not use this
                  app.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors w-full"
            >
              <span>{expanded ? "Hide" : "Read"} full disclaimer</span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expanded && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                <p>
                  <strong>KYRAL MEDICHAT MEDICAL AI CHATBOT DISCLAIMER AND CONSENT</strong>
                  <br />
                  By accessing and using this AI-powered health chatbot (the
                  "Service"), you acknowledge and agree to the following:
                </p>

                <p>
                  <strong>EMERGENCY SITUATIONS</strong>
                  <br />
                  If you are experiencing a medical emergency, call 911 or your
                  local emergency number immediately. DO NOT use this Service
                  for emergency medical situations.
                </p>

                <p>
                  <strong>NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL CARE</strong>
                  <br />
                  This Service provides general health information only and is
                  NOT a substitute for professional medical advice, diagnosis,
                  or treatment. This AI chatbot is not a licensed healthcare
                  provider. Always seek the advice of your physician or other
                  qualified health provider with any questions regarding a
                  medical condition. Never disregard professional medical advice
                  or delay seeking it because of information received from this
                  Service.
                </p>

                <p>
                  <strong>HIPAA AND PRIVACY LIMITATIONS</strong>
                  <br />
                  This Service is NOT covered by the Health Insurance
                  Portability and Accountability Act (HIPAA) in the United
                  States. Information you provide is NOT protected by HIPAA
                  privacy rules. While we implement advanced security measures
                  to protect your data, you should not expect the same privacy
                  protections as you would receive from your doctor or
                  healthcare provider.
                </p>

                <p>
                  <strong>DATA COLLECTION AND USE</strong>
                  <br />
                  By using this Service, you consent to our collection, storage,
                  and processing of health-related information and personally
                  identifying information you provide. This information is used
                  solely to provide the Service to you. We do <strong>NOT</strong> use your
                  health data to train our AI models. We do <strong>NOT</strong> sell your personal
                  data to third parties. Your data may be stored on servers in
                  various locations and may be subject to different state and
                  federal privacy laws in the United States.
                </p>

                <p>
                  <strong>NO DOCTOR-PATIENT RELATIONSHIP</strong>
                  <br />
                  Use of this Service does not create a doctor-patient
                  relationship between you and any healthcare provider, our
                  company, or any third party.
                </p>

                <p>
                  <strong>ACCURACY AND RELIABILITY</strong>
                  <br />
                  While we strive for accuracy, AI-generated responses may
                  contain errors, omissions, or outdated information. We make no
                  warranties regarding the accuracy, completeness, or reliability
                  of information provided.
                </p>

                <p>
                  <strong>VOLUNTARY USE AND ASSUMPTION OF RISK</strong>
                  <br />
                  Your use of this Service is entirely voluntary. By proceeding,
                  you acknowledge that you understand the limitations of
                  AI-generated health information and assume all risks
                  associated with using this Service.
                </p>

                <p>
                  <strong>CONSENT TO TERMS</strong>
                  <br />
                  By clicking "I Agree" or continuing to use this Service, you
                  confirm that you:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>
                      Are at least 18 years of age or have parental/guardian
                      consent
                    </li>
                    <li>Have read and understood this disclaimer</li>
                    <li>
                      Consent to the collection and use of your health
                      information as described
                    </li>
                    <li>Agree to use this Service at your own risk</li>
                    <li>
                      Will consult with qualified healthcare professionals for
                      medical decisions
                    </li>
                  </ul>
                </p>
                <p>Last Updated: 2026-01-11</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <Button onClick={onAccept} className="w-full sm:w-auto">
            I Agree
          </Button>
        </div>
      </div>
    </div>
  );
}

