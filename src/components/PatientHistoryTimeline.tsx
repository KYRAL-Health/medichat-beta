"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { LoadingDots } from "@/components/LoadingDots";

type HistoryItem = {
  type: 'profile' | 'vital' | 'lab' | 'medication' | 'condition' | 'document';
  date: string;
  data: any;
};

export function PatientHistoryTimeline({ patientUserId }: { patientUserId?: string }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = patientUserId 
      ? `/api/patient/history?patientUserId=${patientUserId}`
      : '/api/patient/history';
      
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
      })
      .finally(() => setLoading(false));
  }, [patientUserId]);

  if (loading) return <div className="py-8 text-center"><LoadingDots /></div>;
  if (!history.length) return <div className="text-center text-zinc-500 py-8">No history recorded yet.</div>;

  return (
    <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3 space-y-8 py-4">
      {history.map((item, i) => (
        <div key={i} className="relative pl-6">
          <div className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 ${
            item.type === 'profile' ? 'border-purple-500 bg-purple-100 dark:bg-purple-900' :
            item.type === 'vital' ? 'border-blue-500 bg-blue-100 dark:bg-blue-900' :
            item.type === 'lab' ? 'border-red-500 bg-red-100 dark:bg-red-900' :
            item.type === 'document' ? 'border-orange-500 bg-orange-100 dark:bg-orange-900' :
            'border-zinc-500 bg-zinc-100 dark:bg-zinc-900'
          }`} />
          
          <div className="text-xs text-zinc-500 mb-1">
            {format(new Date(item.date), 'PP p')}
          </div>
          
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full uppercase ${
                item.type === 'profile' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                item.type === 'vital' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                item.type === 'lab' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                item.type === 'document' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                {item.type}
              </span>
            </div>

            <div className="text-sm">
              {item.type === 'profile' && (
                <div className="space-y-1">
                  <div>Profile Updated</div>
                  <div className="text-xs text-zinc-500">
                    Age: {item.data.ageYears || '-'}, Gender: {item.data.gender}
                  </div>
                </div>
              )}
              
              {item.type === 'vital' && (
                <div>
                  {item.data.systolic && `BP: ${item.data.systolic}/${item.data.diastolic}`}
                  {item.data.heartRate && ` HR: ${item.data.heartRate}`}
                  {item.data.temperatureC && ` Temp: ${item.data.temperatureC}°C`}
                </div>
              )}

              {item.type === 'lab' && (
                <div>
                  <div className="font-medium">{item.data.testName}</div>
                  <div>{item.data.valueText} {item.data.unit}</div>
                </div>
              )}

              {item.type === 'medication' && (
                <div>
                  <div className="font-medium">{item.data.medicationName}</div>
                  <div className="text-zinc-500">{item.data.dose} {item.data.frequency}</div>
                </div>
              )}

              {item.type === 'condition' && (
                <div>
                  <div className="font-medium">{item.data.conditionName}</div>
                  <div className="text-zinc-500">{item.data.status}</div>
                </div>
              )}

              {item.type === 'document' && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{item.data.originalFileName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

