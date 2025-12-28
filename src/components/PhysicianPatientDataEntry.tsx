"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function FieldLabel({ children }: { children: string }) {
  return <div className="text-xs text-zinc-500 dark:text-zinc-400">{children}</div>;
}

export function PhysicianPatientDataEntry({ patientUserId }: { patientUserId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [temperatureC, setTemperatureC] = useState("");

  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labUnit, setLabUnit] = useState("");

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medFreq, setMedFreq] = useState("");

  const [conditionName, setConditionName] = useState("");
  const [conditionStatus, setConditionStatus] = useState("");

  const toIntOrNull = (s: string) => {
    const v = s.trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const post = async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
    return json;
  };

  const addVitals = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await post(`/api/patients/${patientUserId}/vitals`, {
        systolic: toIntOrNull(systolic),
        diastolic: toIntOrNull(diastolic),
        heartRate: toIntOrNull(heartRate),
        temperatureC: toIntOrNull(temperatureC),
      });
      setSystolic("");
      setDiastolic("");
      setHeartRate("");
      setTemperatureC("");
      setNotice("Added vitals.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add vitals failed");
    } finally {
      setLoading(false);
    }
  };

  const addLab = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await post(`/api/patients/${patientUserId}/labs`, {
        testName: labName.trim(),
        valueText: labValue.trim(),
        unit: labUnit.trim() ? labUnit.trim() : null,
      });
      setLabName("");
      setLabValue("");
      setLabUnit("");
      setNotice("Added lab.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add lab failed");
    } finally {
      setLoading(false);
    }
  };

  const addMedication = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await post(`/api/patients/${patientUserId}/medications`, {
        medicationName: medName.trim(),
        dose: medDose.trim() ? medDose.trim() : null,
        frequency: medFreq.trim() ? medFreq.trim() : null,
        active: true,
      });
      setMedName("");
      setMedDose("");
      setMedFreq("");
      setNotice("Added medication.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add medication failed");
    } finally {
      setLoading(false);
    }
  };

  const addCondition = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await post(`/api/patients/${patientUserId}/conditions`, {
        conditionName: conditionName.trim(),
        status: conditionStatus.trim() ? conditionStatus.trim() : null,
      });
      setConditionName("");
      setConditionStatus("");
      setNotice("Added condition.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add condition failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Add data for patient</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Anything you add here is stored on the patient record (the patient will see it too).
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-800 dark:text-green-200">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Vitals</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>Systolic</FieldLabel>
              <input
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="120"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Diastolic</FieldLabel>
              <input
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="80"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Heart rate</FieldLabel>
              <input
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="72"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Temp (°C)</FieldLabel>
              <input
                value={temperatureC}
                onChange={(e) => setTemperatureC(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="37"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addVitals()}
            disabled={loading}
            className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Add vitals
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Lab result</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Test name</FieldLabel>
              <input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="HbA1c"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Value</FieldLabel>
                <input
                  value={labValue}
                  onChange={(e) => setLabValue(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="6.1"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Unit</FieldLabel>
                <input
                  value={labUnit}
                  onChange={(e) => setLabUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="%"
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addLab()}
            disabled={loading || !labName.trim() || !labValue.trim()}
            className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Add lab
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Medication</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Name</FieldLabel>
              <input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="Metformin"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Dose</FieldLabel>
                <input
                  value={medDose}
                  onChange={(e) => setMedDose(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="500mg"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Frequency</FieldLabel>
                <input
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="BID"
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addMedication()}
            disabled={loading || !medName.trim()}
            className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Add medication
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Condition</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Name</FieldLabel>
              <input
                value={conditionName}
                onChange={(e) => setConditionName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="Hypertension"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Status</FieldLabel>
              <input
                value={conditionStatus}
                onChange={(e) => setConditionStatus(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="controlled"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addCondition()}
            disabled={loading || !conditionName.trim()}
            className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Add condition
          </button>
        </div>
      </div>
    </section>
  );
}


