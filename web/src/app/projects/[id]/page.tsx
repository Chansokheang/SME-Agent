"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";

/** Sends the user to the first stage that still needs work. */
export default function ProjectIndex() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    api.getProject(id).then((detail) => {
      const current =
        detail.stages.find((s) => s.status === "active" && s.implemented) ??
        detail.stages.find((s) => s.status === "active") ??
        detail.stages[0];
      router.replace(`/projects/${id}/${current.key}`);
    });
  }, [id, router]);

  return (
    <main className="mx-auto max-w-[1400px] animate-pulse px-4 py-5 md:px-6" aria-label="Loading project">
      <div className="h-6 w-56 rounded bg-surface-2" />
      <div className="mt-4 h-14 rounded-2xl bg-surface-2" />
    </main>
  );
}
