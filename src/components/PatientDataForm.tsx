"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Profile = {
  ageYears: number | null;
  gender: string;
  historyOfPresentIllness: string | null;
  symptomOnset: string | null;
  symptomDuration: string | null;
  smokingStatus: string;
  alcoholConsumption: string;
  physicalActivityLevel: string;
} | null;

function FieldLabel({ children }: { children: string }) {
  return <div className="text-xs text-zinc-500 dark:text-zinc-400">{children}</div>;
}

export function PatientDataForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>(null);
  const [ageYears, setAgeYears] = useState<string>("");
  const [gender, setGender] = useState<string>("unknown");
  const [smokingStatus, setSmokingStatus] = useState<string>("unknown");
  const [alcoholConsumption, setAlcoholConsumption] = useState<string>("unknown");
  const [physicalActivityLevel, setPhysicalActivityLevel] = useState<string>("unknown");
  const [hpi, setHpi] = useState<string>("");
  const [symptomOnset, setSymptomOnset] = useState<string>("");
  const [symptomDuration, setSymptomDuration] = useState<string>("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/profile", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);

      const p = body.profile ?? null;
      setProfile(p);

      setAgeYears(p?.ageYears != null ? String(p.ageYears) : "");
      setGender(p?.gender ?? "unknown");
      setSmokingStatus(p?.smokingStatus ?? "unknown");
      setAlcoholConsumption(p?.alcoholConsumption ?? "unknown");
      setPhysicalActivityLevel(p?.physicalActivityLevel ?? "unknown");
      setHpi(p?.historyOfPresentIllness ?? "");
      setSymptomOnset(p?.symptomOnset ?? "");
      setSymptomDuration(p?.symptomDuration ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveProfile = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const parsedAge = ageYears.trim() ? Number(ageYears) : null;
        const payload = {
          ageYears: Number.isFinite(parsedAge) ? parsedAge : null,
          gender,
          smokingStatus,
          alcoholConsumption,
          physicalActivityLevel,
          historyOfPresentIllness: hpi.trim() ? hpi.trim() : null,
          symptomOnset: symptomOnset.trim() ? symptomOnset.trim() : null,
          symptomDuration: symptomDuration.trim() ? symptomDuration.trim() : null,
        };

        const res = await fetch("/api/patient/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; profile?: Profile };
        if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);

        setProfile(body.profile ?? null);
        setNotice("Saved profile.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setLoading(false);
      }
    },
    [
      ageYears,
      gender,
      smokingStatus,
      alcoholConsumption,
      physicalActivityLevel,
      hpi,
      symptomOnset,
      symptomDuration,
    ]
  );

  const [vitalsSystolic, setVitalsSystolic] = useState("");
  const [vitalsDiastolic, setVitalsDiastolic] = useState("");
  const [vitalsHr, setVitalsHr] = useState("");
  const [vitalsTemp, setVitalsTemp] = useState("");

  const addVitals = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const toIntOrNull = (s: string) => {
        const v = s.trim();
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : null;
      };
      const payload = {
        systolic: toIntOrNull(vitalsSystolic),
        diastolic: toIntOrNull(vitalsDiastolic),
        heartRate: toIntOrNull(vitalsHr),
        temperatureC: toIntOrNull(vitalsTemp),
      };
      const res = await fetch("/api/patient/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Add vitals failed (${res.status})`);
      setVitalsSystolic("");
      setVitalsDiastolic("");
      setVitalsHr("");
      setVitalsTemp("");
      setNotice("Added vitals.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add vitals failed");
    } finally {
      setLoading(false);
    }
  }, [vitalsSystolic, vitalsDiastolic, vitalsHr, vitalsTemp]);

  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labUnit, setLabUnit] = useState("");

  const addLab = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/patient/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testName: labName.trim(),
          valueText: labValue.trim(),
          unit: labUnit.trim() ? labUnit.trim() : null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Add lab failed (${res.status})`);
      setLabName("");
      setLabValue("");
      setLabUnit("");
      setNotice("Added lab result.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add lab failed");
    } finally {
      setLoading(false);
    }
  }, [labName, labValue, labUnit]);

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medFreq, setMedFreq] = useState("");

  const addMedication = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/patient/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationName: medName.trim(),
          dose: medDose.trim() ? medDose.trim() : null,
          frequency: medFreq.trim() ? medFreq.trim() : null,
          active: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Add medication failed (${res.status})`);
      setMedName("");
      setMedDose("");
      setMedFreq("");
      setNotice("Added medication.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add medication failed");
    } finally {
      setLoading(false);
    }
  }, [medName, medDose, medFreq]);

  const [conditionName, setConditionName] = useState("");
  const [conditionStatus, setConditionStatus] = useState("");

  const addCondition = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/patient/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionName: conditionName.trim(),
          status: conditionStatus.trim() ? conditionStatus.trim() : null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Add condition failed (${res.status})`);
      setConditionName("");
      setConditionStatus("");
      setNotice("Added condition.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add condition failed");
    } finally {
      setLoading(false);
    }
  }, [conditionName, conditionStatus]);

  const enums = useMemo(
    () => ({
      gender: ["female", "male", "nonbinary", "other", "unknown"],
      smoking: ["never", "former", "current", "unknown"],
      alcohol: ["none", "occasional", "moderate", "heavy", "unknown"],
      activity: ["sedentary", "light", "moderate", "high", "unknown"],
    }),
    []
  );

  return (
    <div className="space-y-6">
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

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Baseline profile</h2>
          <button
            type="button"
            onClick={() => void loadProfile()}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel>Age</FieldLabel>
            <input
              value={ageYears}
              onChange={(e) => setAgeYears(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
              placeholder="e.g. 42"
            />
          </div>

          <div className="space-y-1">
            <FieldLabel>Gender</FieldLabel>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
            >
              {enums.gender.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <FieldLabel>Smoking status</FieldLabel>
            <select
              value={smokingStatus}
              onChange={(e) => setSmokingStatus(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
            >
              {enums.smoking.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <FieldLabel>Alcohol consumption</FieldLabel>
            <select
              value={alcoholConsumption}
              onChange={(e) => setAlcoholConsumption(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
            >
              {enums.alcohol.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <FieldLabel>Physical activity</FieldLabel>
            <select
              value={physicalActivityLevel}
              onChange={(e) => setPhysicalActivityLevel(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
            >
              {enums.activity.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 space-y-1">
            <FieldLabel>History of Present Illness</FieldLabel>
            <textarea
              value={hpi}
              onChange={(e) => setHpi(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm min-h-24"
              placeholder="What’s going on? Include key symptoms, context, and what you’ve tried."
            />
          </div>

          <div className="space-y-1">
            <FieldLabel>Symptom onset</FieldLabel>
            <input
              value={symptomOnset}
              onChange={(e) => setSymptomOnset(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
              placeholder="e.g. 3 days ago"
            />
          </div>

          <div className="space-y-1">
            <FieldLabel>Symptom duration</FieldLabel>
            <input
              value={symptomDuration}
              onChange={(e) => setSymptomDuration(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
              placeholder="e.g. intermittent, worse at night"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save profile"}
            </button>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              {profile ? "Loaded from database." : "No profile saved yet."}
            </div>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Add vitals</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>Systolic</FieldLabel>
              <input
                value={vitalsSystolic}
                onChange={(e) => setVitalsSystolic(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="120"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Diastolic</FieldLabel>
              <input
                value={vitalsDiastolic}
                onChange={(e) => setVitalsDiastolic(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="80"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Heart rate</FieldLabel>
              <input
                value={vitalsHr}
                onChange={(e) => setVitalsHr(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="72"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Temp (°C)</FieldLabel>
              <input
                value={vitalsTemp}
                onChange={(e) => setVitalsTemp(e.target.value)}
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

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Add lab</h2>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Test name</FieldLabel>
              <input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="e.g. HbA1c"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Value</FieldLabel>
                <input
                  value={labValue}
                  onChange={(e) => setLabValue(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="e.g. 6.1"
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

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Add medication</h2>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Name</FieldLabel>
              <input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="e.g. Metformin"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Dose</FieldLabel>
                <input
                  value={medDose}
                  onChange={(e) => setMedDose(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="e.g. 500mg"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Frequency</FieldLabel>
                <input
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                  placeholder="e.g. BID"
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

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Add condition</h2>
          <div className="space-y-2">
            <div className="space-y-1">
              <FieldLabel>Name</FieldLabel>
              <input
                value={conditionName}
                onChange={(e) => setConditionName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="e.g. Hypertension"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Status</FieldLabel>
              <input
                value={conditionStatus}
                onChange={(e) => setConditionStatus(e.target.value)}
                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
                placeholder="e.g. controlled"
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
      </section>
    </div>
  );
}


