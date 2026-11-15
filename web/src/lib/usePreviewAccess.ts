"use client";

import { useEffect, useState } from "react";

import { api, PUBLIC, type PreviewAccess } from "./api";

/** Keeps a fresh preview ticket while Gagesite is open on its tunnel link (null anywhere else). */
export function usePreviewAccess(): PreviewAccess | null {
  const [access, setAccess] = useState<PreviewAccess | null>(null);
  useEffect(() => {
    if (!PUBLIC) return;
    let live = true;
    const load = () =>
      api
        .previewAccess()
        .then((a) => live && setAccess(a.origin || a.api_origin ? a : null))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 40_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  return access;
}
