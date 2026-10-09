"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StudentAuthView } from "@/components/StudentAuthView";
import { getStoredStudent } from "@/services/authApi";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const problemParam = searchParams.get("problem") || searchParams.get("id");

  useEffect(() => {
    const student = getStoredStudent();
    if (student) {
      if (problemParam) {
        router.replace(`/?problem=${encodeURIComponent(problemParam)}`);
      } else {
        router.replace("/");
      }
    }
  }, [router, problemParam]);

  return (
    <StudentAuthView
      intendedProblemSlug={problemParam}
      onSuccess={() => {
        if (problemParam) {
          router.replace(`/?problem=${encodeURIComponent(problemParam)}`);
        } else {
          router.replace("/");
        }
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
