"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { ENVIRONMENT_CHANGE_EVENT } from "@/services/environment";
import type { Question } from "@/types/question";

export default function Home() {
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestVersion = 0;
    async function loadQuestion() {
      const currentRequest = ++requestVersion;
      setLoading(true);
      setError(null);
      setQuestion(null);
      try {
        const questions = await questionsApi.list("PUBLISHED");
        if (!cancelled && currentRequest === requestVersion && questions[0]) {
          setQuestion(toQuestionData(questions[0]));
        }
      } catch (err: unknown) {
        if (!cancelled && currentRequest === requestVersion) {
          setError(err instanceof Error ? err.message : "Could not load published questions.");
        }
      } finally {
        if (!cancelled && currentRequest === requestVersion) setLoading(false);
      }
    }

    void loadQuestion();
    window.addEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestion);

    return () => {
      cancelled = true;
      window.removeEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestion);
    };
  }, []);

  if (question) return <StudentWorkspace question={question} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <p className="text-2xl font-black tracking-tight text-sky-400">ZAP</p>
        <h1 className="mt-4 text-xl font-semibold">
          {loading ? "Loading published questions…" : error ? "Could not reach the question API" : "No published questions in this environment"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {error ?? "Create a question in the Faculty Portal, add at least one enabled test case, and publish it. Then return here to run code against the selected QA or production environment."}
        </p>
        {!loading && (
          <Link
            href="/faculty/questions"
            className="mt-6 inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
          >
            Open Faculty Portal
          </Link>
        )}
      </section>
    </main>
  );
}

function toQuestionData(question: Question): QuestionData {
  return {
    id: question.id,
    slug: question.slug,
    title: question.title,
    difficulty: question.difficulty,
    tags: question.tags,
    statement: question.statement,
    examples: question.examples ?? [],
    constraints: question.constraints,
  };
}
