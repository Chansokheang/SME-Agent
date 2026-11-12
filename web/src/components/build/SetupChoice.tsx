"use client";

import {
  Browser,
  Check,
  CircleNotch,
  CloudArrowDown,
  Copy,
  Cube,
  FilmStrip,
  SignIn,
  Sparkle,
  StackSimple,
  UploadSimple,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  api,
  type BuildSetup,
  type BuildSetupChoice,
  type FlowJob,
  type FlowStatus,
  type LandingStyle,
  type VideoPrompt,
} from "@/lib/api";

const OPTIONS: { key: BuildSetup["setup"]; icon: Icon; title: string; text: string; when: string; tag?: string }[] = [
  {
    key: "all_in_one",
    icon: Browser,
    title: "UI + API together",
    text: "Pages and API in one project (Next.js + Prisma), with your own database.",
    when: "Best for most websites.",
    tag: "Recommended",
  },
  {
    key: "api_service",
    icon: StackSimple,
    title: "UI + dedicated API",
    text: "The website, plus its own separate API service (TypeScript or Python).",
    when: "Best when an app or your developers will use the API too.",
  },
  {
    key: "static_external",
    icon: CloudArrowDown,
    title: "Static UI",
    text: "Just the pages: no backend or database of our own. They can call another service's API, connected now or later.",
    when: "Best for a UI that plugs into a system you already have.",
  },
  {
    key: "landing",
    icon: Sparkle,
    title: "Landing page",
    text: "One commercial, modern page that sells your business in a single scroll. No database or logins.",
    when: "Best for a launch, a campaign or a small business that needs one great page.",
  },
];

const STYLES: { key: LandingStyle; icon: Icon; title: string; text: string }[] = [
  { key: "modern", icon: Sparkle, title: "Modern", text: "Layered visuals and smooth scroll motion" },
  { key: "3d", icon: Cube, title: "3D", text: "A live 3D scene that moves with the visitor" },
  { key: "video", icon: FilmStrip, title: "Video", text: "A full-screen video you make in Google Flow" },
];

/** "How should it be built?" on the Implementation start panel. */
export default function SetupChoice({
  projectId,
  setup,
  busy,
  onChoose,
  onSetup,
}: {
  projectId: string;
  setup: BuildSetup;
  busy: boolean;
  onChoose: (next: BuildSetupChoice) => void;
  onSetup: (next: BuildSetup) => void;
}) {
  const choice = (patch: Partial<BuildSetupChoice>): BuildSetupChoice => ({
    setup: setup.setup,
    api_language: setup.api_language,
    api_base_url: setup.api_base_url,
    api_docs_url: setup.api_docs_url,
    api_auth: setup.api_auth,
    api_notes: setup.api_notes,
    landing_style: setup.landing_style ?? "modern",
    ...patch,
  });
  // With UI Design skipped there is no design for a full website: only the landing page is offered.
  const options = setup.design_skipped ? OPTIONS.filter((o) => o.key === "landing") : OPTIONS;
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h3 className="font-display text-[17px] font-bold tracking-tight">How should it be built?</h3>
      <p className="mt-1 text-sm text-muted">
        {setup.design_skipped
          ? "You skipped UI Design, so Gagesite builds a landing page and designs it here."
          : "Visitors see the same site either way. Not sure? Keep the recommended one."}
      </p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="How the website is built">
        {options.map((option) => {
          const available = setup.available.includes(option.key);
          const selected = setup.setup === option.key;
          return (
            <div key={option.key}>
              <button
                role="radio"
                aria-checked={selected}
                disabled={!available || busy || setup.locked}
                onClick={() => onChoose(choice({ setup: option.key }))}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition duration-200 disabled:cursor-not-allowed ${
                  selected
                    ? "border-accent bg-accent-soft/50 shadow-[0_10px_24px_-18px_rgba(34,102,212,0.7)]"
                    : "border-line hover:border-line-strong enabled:hover:-translate-y-0.5"
                } ${available ? "" : "opacity-55"}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    selected ? "bg-accent text-white" : "bg-surface-2 text-accent"
                  }`}
                >
                  <option.icon size={18} weight="duotone" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {option.title}
                    {option.tag && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          option.tag === "Recommended" ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {option.tag}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{option.text}</span>
                  <span className="mt-1 block text-xs font-medium leading-relaxed text-ink/80">{option.when}</span>
                </span>
                <span
                  aria-hidden
                  className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                    selected ? "border-accent" : "border-line-strong"
                  }`}
                >
                  {selected && <span className="size-2 rounded-full bg-accent" />}
                </span>
              </button>
              {option.key === "static_external" && !!setup.server_keys?.length && (
                <p
                  className={`mt-1.5 flex gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    selected ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"
                  }`}
                >
                  <WarningCircle size={14} weight="bold" className="mt-0.5 shrink-0" />
                  <span>
                    Can&apos;t use your secret keys ({setup.server_keys.slice(0, 3).join(", ")}
                    {setup.server_keys.length > 3 ? ` and ${setup.server_keys.length - 3} more` : ""}): a static UI has
                    no server to keep them on, so those features only show sample answers. Pick one of the other two to
                    connect them.
                  </span>
                </p>
              )}
              {selected && option.key === "api_service" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-surface px-4 py-3 text-xs [animation:rise-in_200ms_ease-out]">
                  <span className="mr-1 font-semibold text-muted">API written in</span>
                  {(
                    [
                      ["typescript", "TypeScript", "Hono + Prisma"],
                      ["python", "Python", "FastAPI + SQLAlchemy"],
                    ] as const
                  ).map(([value, label, stack]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={setup.api_language === value}
                      disabled={busy || setup.locked}
                      onClick={() => onChoose(choice({ api_language: value }))}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition active:scale-[0.98] disabled:opacity-60 ${
                        setup.api_language === value
                          ? "border-accent bg-accent-soft/60 font-semibold text-accent-ink"
                          : "border-line-strong hover:border-accent"
                      }`}
                    >
                      {label}
                      <span className="font-normal text-faint">{stack}</span>
                    </button>
                  ))}
                </div>
              )}
              {selected && option.key === "landing" && (
                <div className="mt-2 rounded-2xl border border-accent/30 bg-surface px-4 py-3 [animation:rise-in_200ms_ease-out]">
                  <p className="text-xs font-semibold text-muted">The showpiece at the top of the page</p>
                  <div role="radiogroup" aria-label="Landing page showpiece" className="mt-2 grid gap-2 @lg:grid-cols-3">
                    {STYLES.map((style) => {
                      const on = (setup.landing_style ?? "modern") === style.key;
                      return (
                        <button
                          key={style.key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={busy || setup.locked}
                          onClick={() => onChoose(choice({ landing_style: style.key }))}
                          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                            on ? "border-accent bg-accent-soft/60" : "border-line-strong enabled:hover:border-accent"
                          }`}
                        >
                          <style.icon size={16} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
                          <span className="min-w-0">
                            <span className={`block text-xs ${on ? "font-semibold text-accent-ink" : "font-medium"}`}>
                              {style.title}
                            </span>
                            <span className="block text-[11px] leading-snug text-muted">{style.text}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {setup.landing_style === "video" && (
                    <div className="mt-3 border-t border-line pt-3">
                      <LandingVideo projectId={projectId} setup={setup} onSetup={onSetup} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const SMALL_BUTTON =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-medium transition hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-50";

/**
 * The landing page's hero video. Gagesite makes it with Google Flow in the background (the
 * owner's own Flow account, signed in once), or the owner uploads a clip they made themselves.
 * Until there is one, the page shows a matching still design.
 */
export function LandingVideo({
  projectId,
  setup,
  onSetup,
  compact = false,
}: {
  projectId: string;
  setup: BuildSetup;
  onSetup: (next: BuildSetup) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowStatus | null>(null);
  const [jobs, setJobs] = useState<FlowJob[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const video = setup.landing_video;
  const prompts = setup.video_prompts ?? [];
  const running = jobs.find((j) => j.status === "queued" || j.status === "running");
  const lastFailed = !running ? jobs.filter((j) => j.status === "failed").at(-1) : undefined;

  useEffect(() => {
    api.getFlow().then(setFlow).catch(() => setFlow(null));
    api.landingVideoJobs(projectId).then(setJobs).catch(() => {});
  }, [projectId]);

  // While a video is being made (or the sign-in window is open), follow along.
  const waiting = !!running || !!flow?.signing_in;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      try {
        const [next, status] = await Promise.all([api.landingVideoJobs(projectId), api.getFlow()]);
        setJobs(next);
        setFlow(status);
        if (!next.some((j) => j.status === "queued" || j.status === "running")) {
          onSetup(await api.getBuildSetup(projectId));
        }
      } catch {}
    }, 4000);
    return () => window.clearInterval(timer);
  }, [waiting, projectId, onSetup]);

  async function act(key: string, work: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const upload = (file: File | undefined) =>
    file && act("upload", async () => onSetup(await api.uploadLandingVideo(projectId, file)));
  const remove = () => act("remove", async () => onSetup(await api.deleteLandingVideo(projectId)));
  const signIn = () => act("signin", async () => setFlow(await api.flowSignIn()));
  const check = () => act("check", async () => setFlow(await api.flowCheck()));
  const generate = (p: VideoPrompt) =>
    act("generate", async () => {
      const job = await api.generateLandingVideo(projectId, p);
      setJobs((list) => [...list, job]);
    });

  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <div className={compact ? "rounded-2xl border border-line px-4 py-3" : ""}>
      <div className="flex items-start gap-3">
        <FilmStrip size={18} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {video ? "Your hero video is in" : "Hero video"}
            {video && (
              <span className="ml-1.5 font-normal text-muted">({(video.size / 1024 / 1024).toFixed(1)} MB)</span>
            )}
          </p>
          <p className="text-[11px] leading-snug text-muted">
            {video
              ? "The page plays it at the top. Make or upload another to replace it."
              : prompts.length
                ? "Gagesite makes it with Google Flow using your Flow credits, or upload a clip you made. Until then the page shows a matching still design."
                : "Gagesite writes the video prompts while it builds the page; then it can make the video with Google Flow. You can also upload a clip you made."}
          </p>

          {/* Google Flow: Gagesite's own sign-in, made once. */}
          {flow && !flow.signed_in && (
            <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
              {!flow.chrome_found ? (
                "Making videos with Google Flow needs Google Chrome on this computer."
              ) : flow.signing_in ? (
                <>
                  A Chrome window is open on Google Flow. Sign in with your Google account there, click Next on any
                  welcome box (leave the boxes unticked), then <span className="font-semibold text-ink">close that window</span>{" "}
                  and press Check.
                </>
              ) : (
                "To make videos automatically, sign in to Google Flow once. Gagesite opens a Chrome window for it and never sees your password."
              )}
              {flow.chrome_found && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!flow.signing_in && (
                    <button type="button" onClick={signIn} disabled={busy !== null} className={SMALL_BUTTON}>
                      {busy === "signin" ? <CircleNotch size={14} className="animate-spin" /> : <SignIn size={14} />}
                      Sign in to Google Flow
                    </button>
                  )}
                  <button type="button" onClick={check} disabled={busy !== null} className={SMALL_BUTTON}>
                    {busy === "check" ? <CircleNotch size={14} className="animate-spin" /> : null}
                    {busy === "check" ? "Checking..." : "Check"}
                  </button>
                </div>
              )}
            </div>
          )}

          {running && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-accent-soft/60 px-3 py-2 text-[11px] font-medium text-accent-ink">
              <CircleNotch size={14} className="shrink-0 animate-spin" />
              {running.step.replace(/\(usually [^)]*\)/, "").trim()}
              <span className="ml-auto shrink-0 font-normal text-muted">usually 2 to 8 minutes</span>
            </p>
          )}
          {lastFailed && <p className="mt-2 text-[11px] leading-relaxed text-danger">{lastFailed.error}</p>}

          {prompts.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {prompts.map((p, i) => (
                <li key={i} className="rounded-xl border border-line px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold">{p.title}</span>
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                      {p.aspect === "9:16" ? "Phone 9:16" : "Wide 16:9"} · {p.seconds}s loop
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted" title={p.prompt}>
                    {p.prompt}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => generate(p)}
                      disabled={busy !== null || !!running || !flow?.signed_in}
                      title={flow?.signed_in ? "Uses your Google Flow credits" : "Sign in to Google Flow first"}
                      className={SMALL_BUTTON}
                    >
                      <Sparkle size={14} />
                      Make with Google Flow
                    </button>
                    <button type="button" onClick={() => copy(p.prompt, i)} className={SMALL_BUTTON}>
                      {copied === i ? <Check size={14} /> : <Copy size={14} />}
                      {copied === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {video && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null || !!running}
                className="text-xs font-medium text-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy !== null || !!running}
              className={SMALL_BUTTON}
            >
              {busy === "upload" ? <CircleNotch size={14} className="animate-spin" /> : <UploadSimple size={14} />}
              {busy === "upload" ? "Uploading..." : video ? "Upload another" : "Upload a video"}
            </button>
            <input
              ref={input}
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
