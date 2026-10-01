"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { questionsApi } from "@/services/questionsApi";
import type { QuestionFormData, TestCase, Difficulty, QuestionStatus } from "@/types/question";

const EMPTY_FORM: QuestionFormData = {
  slug: "",
  title: "",
  difficulty: "EASY",
  tags: [],
  statement: "",
  constraints: [],
  testCases: [],
  executionLimits: { timeMs: 2000, memoryMb: 256, outputKb: 1024 },
  supportedLanguages: ["python", "java", "cpp", "node"],
  status: "DRAFT",
};

export default function NewQuestionPage() {
  const router = useRouter();
  const [form, setForm] = useState<QuestionFormData>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [constraintInput, setConstraintInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JSON import
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const update = (key: keyof QuestionFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) update("tags", [...form.tags, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    update("tags", form.tags.filter((t) => t !== tag));
  }

  function addConstraint() {
    const c = constraintInput.trim();
    if (c) update("constraints", [...form.constraints, c]);
    setConstraintInput("");
  }

  function addTestCase() {
    const tc: TestCase = {
      id: `tc-${Date.now()}`,
      visibility: "PUBLIC",
      input: "",
      expectedOutput: "",
      enabled: true,
    };
    update("testCases", [...form.testCases, tc]);
  }

  function updateTestCase(idx: number, key: keyof TestCase, value: unknown) {
    const tcs = [...form.testCases];
    tcs[idx] = { ...tcs[idx], [key]: value };
    update("testCases", tcs);
  }

  function removeTestCase(idx: number) {
    update("testCases", form.testCases.filter((_, i) => i !== idx));
  }

  function handleImportJson() {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      // Basic validation
      if (!parsed.title || !parsed.slug || !parsed.statement) {
        throw new Error("JSON must include: title, slug, statement");
      }
      setForm({
        ...EMPTY_FORM,
        ...parsed,
        executionLimits: { ...EMPTY_FORM.executionLimits, ...(parsed.executionLimits ?? {}) },
        testCases: parsed.testCases ?? [],
        tags: parsed.tags ?? [],
        constraints: parsed.constraints ?? [],
        supportedLanguages: parsed.supportedLanguages ?? EMPTY_FORM.supportedLanguages,
      });
      setJsonMode(false);
    } catch (e: any) {
      setJsonError(e.message ?? "Invalid JSON");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await questionsApi.create(form);
      router.push("/faculty/questions");
    } catch (err: any) {
      setError(err.message ?? "Failed to save. Is the backend running?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
            ← Back
          </button>
          <span className="text-sky-400 font-black text-xl tracking-tight">ZAP</span>
          <span className="text-slate-500 text-sm">New Question</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* JSON Import Banner */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Question</h1>
          <button
            onClick={() => setJsonMode((v) => !v)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:text-sky-400 px-3 py-1.5 rounded transition-colors"
          >
            {jsonMode ? "← Back to Form" : "Import from JSON"}
          </button>
        </div>

        {/* JSON Import Panel */}
        {jsonMode && (
          <div className="mb-8 bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
            <p className="text-sm text-slate-400">Paste a JSON question definition. Required fields: <code className="text-sky-400">slug</code>, <code className="text-sky-400">title</code>, <code className="text-sky-400">statement</code>.</p>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={12}
              placeholder='{ "slug": "two-sum", "title": "Two Sum", "statement": "...", ... }'
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {jsonError && <p className="text-rose-400 text-xs">{jsonError}</p>}
            <button
              onClick={handleImportJson}
              className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-5 py-2 rounded transition-colors"
            >
              Validate &amp; Preview
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Details */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Basic Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title *</label>
                <input required value={form.title} onChange={(e) => update("title", e.target.value)}
                  placeholder="Two Sum"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Slug *</label>
                <input required value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="two-sum"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
                <select value={form.difficulty} onChange={(e) => update("difficulty", e.target.value as Difficulty)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500">
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select value={form.status} onChange={(e) => update("status", e.target.value as QuestionStatus)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500">
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tags</label>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="e.g. array"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                <button type="button" onClick={addTag}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-colors">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5">×</button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Problem Statement */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Problem Statement</h2>
            <textarea required value={form.statement} onChange={(e) => update("statement", e.target.value)}
              rows={8}
              placeholder="Describe the problem in full detail..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Constraints (one per line)</label>
              <div className="flex gap-2">
                <input value={constraintInput} onChange={(e) => setConstraintInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addConstraint(); } }}
                  placeholder="2 <= nums.length <= 10^4"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                <button type="button" onClick={addConstraint}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-colors">
                  Add
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {form.constraints.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="flex-1">{c}</span>
                    <button type="button" onClick={() => update("constraints", form.constraints.filter((_, j) => j !== i))}
                      className="text-slate-600 hover:text-rose-400 transition-colors">×</button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Execution Limits */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Execution Limits</h2>
            <div className="grid grid-cols-3 gap-4">
              {(["timeMs", "memoryMb", "outputKb"] as const).map((key) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">
                    {key === "timeMs" ? "Time (ms)" : key === "memoryMb" ? "Memory (MB)" : "Output (KB)"}
                  </label>
                  <input type="number" min={0}
                    value={form.executionLimits[key]}
                    onChange={(e) => update("executionLimits", { ...form.executionLimits, [key]: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                </div>
              ))}
            </div>
          </section>

          {/* Test Cases */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Test Cases</h2>
              <button type="button" onClick={addTestCase}
                className="text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors">
                + Add Test Case
              </button>
            </div>
            <div className="space-y-4">
              {form.testCases.map((tc, idx) => (
                <div key={tc.id} className="bg-slate-950/60 border border-slate-700/80 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Test Case #{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={tc.enabled} onChange={(e) => updateTestCase(idx, "enabled", e.target.checked)} className="accent-sky-500" />
                        Enabled
                      </label>
                      <select value={tc.visibility} onChange={(e) => updateTestCase(idx, "visibility", e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500">
                        <option value="PUBLIC">Public</option>
                        <option value="HIDDEN">Hidden</option>
                      </select>
                      <button type="button" onClick={() => removeTestCase(idx)} className="text-slate-600 hover:text-rose-400 transition-colors text-sm">×</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Input</label>
                      <textarea rows={3} value={tc.input} onChange={(e) => updateTestCase(idx, "input", e.target.value)}
                        placeholder="stdin input..."
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-300 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Expected Output</label>
                      <textarea rows={3} value={tc.expectedOutput} onChange={(e) => updateTestCase(idx, "expectedOutput", e.target.value)}
                        placeholder="expected stdout..."
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-300 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    </div>
                  </div>
                </div>
              ))}
              {form.testCases.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-4">No test cases yet. Add one above.</p>
              )}
            </div>
          </section>

          {error && (
            <div className="px-4 py-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save Question"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
