"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails of the owner's uploads, served by our backend */

import {
  ArrowRight,
  CaretDown,
  Check,
  CircleNotch,
  Cube,
  Plus,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import LandingSkipCard from "@/components/LandingSkipCard";
import {
  api,
  type DesignEngine,
  type DesignFileKind,
  type DesignKit,
  type PhotoTag,
  type StitchStatus,
} from "@/lib/api";

const TAGS: { value: PhotoTag; label: string }[] = [
  { value: "hero", label: "Top of home page" },
  { value: "menu", label: "Menu / products" },
  { value: "about", label: "About us" },
  { value: "gallery", label: "Gallery" },
  { value: "other", label: "Gagesite decides" },
];

const IMAGES = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";

/** First screen of Stage 3: everything optional. Gives Gagesite the owner's brand before it designs. */
export default function DesignKitStart({
  projectId,
  kit,
  onKitChange,
  onStart,
  onSkip,
}: {
  projectId: string;
  kit: DesignKit;
  onKitChange: (kit: DesignKit) => void;
  onStart: (kit: DesignKit) => void;
  /** Skip UI Design and build a landing page (what was added here is kept for it). */
  onSkip?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colors, setColors] = useState(kit.colors);
  const [styleNotes, setStyleNotes] = useState(kit.style_notes);
  const [avoid, setAvoid] = useState(kit.avoid);
  const [showcase, setShowcase] = useState(Boolean(kit.showcase_3d));
  const [engine, setEngine] = useState<DesignEngine>(
    kit.design_engine ?? "gagesite",
  );
  const [stitch, setStitch] = useState<StitchStatus | null>(null);
  useEffect(() => {
    api
      .getStitch()
      .then(setStitch)
      .catch(() => setStitch(null));
  }, []);
  const stitchMissing = engine === "stitch" && !stitch?.connected;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const avoidRef = useRef<HTMLTextAreaElement>(null);
  useMatchedHeights([notesRef, avoidRef], `${styleNotes}\u0000${avoid}`);

  async function upload(kind: DesignFileKind, files: File[]) {
    if (!files.length) return;
    setBusy(kind);
    setError(null);
    try {
      let latest = kit;
      for (const file of files)
        latest = await api.uploadDesignFile(projectId, kind, file);
      onKitChange(latest);
      if (kind === "model") setShowcase(Boolean(latest.showcase_3d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: DesignFileKind, file: string) {
    setError(null);
    try {
      onKitChange(await api.deleteDesignFile(projectId, kind, file));
      if (kind === "model") setShowcase(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveKit() {
    const saved = await api.putDesignKit(projectId, {
      colors,
      style_notes: styleNotes,
      avoid,
      mockup_format: "html",
      showcase_3d: showcase,
      design_engine: engine,
    });
    onKitChange(saved);
    return saved;
  }

  async function start() {
    setBusy("start");
    setError(null);
    try {
      onStart(await saveKit());
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function skip() {
    if (!onSkip) return;
    setBusy("skip");
    setError(null);
    try {
      await saveKit(); // the logo, colours, photos and notes still shape the landing page
      await onSkip();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const [more, setMore] = useState(Boolean(kit.model));
  const summary = [
    kit.logo && "logo",
    colors.length &&
      `${colors.length} ${colors.length === 1 ? "colour" : "colours"}`,
    kit.photos.length &&
      `${kit.photos.length} ${kit.photos.length === 1 ? "photo" : "photos"}`,
    (styleNotes.trim() || avoid.trim() || kit.references.length) &&
      "style notes",
    kit.model && "3D model",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl pb-2">
      <header>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
          What should your website look like?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Everything here is optional. Add what you have, skip the rest, and
          Gagesite picks what fits your business.
        </p>
      </header>

      <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        <Row
          title="Logo"
          done={Boolean(kit.logo)}
          hint="No logo? Gagesite sets your name as a clean wordmark."
          action={
            <UploadButton
              label={kit.logo ? "Replace" : "Upload"}
              accept={IMAGES}
              busy={busy === "logo"}
              onFiles={(f) => upload("logo", f.slice(0, 1))}
            />
          }
        >
          {kit.logo && (
            <div className="flex items-center gap-3 [animation:rise-in_200ms_ease-out]">
              <img
                src={api.previewUrl(projectId, `brand/${kit.logo}`)}
                alt="Your logo"
                className="h-10 max-w-[160px] rounded-md border border-line bg-white object-contain p-1"
              />
              <TextButton onClick={() => remove("logo", kit.logo!)}>
                Remove
              </TextButton>
            </div>
          )}
        </Row>

        <Row
          title="Colours"
          done={colors.length > 0}
          hint={
            colors.length
              ? "Click a swatch to change it."
              : "Your brand colours, up to 4. Otherwise Gagesite picks a palette."
          }
          action={
            <button
              type="button"
              onClick={() => setColors([...colors, "#2266d4"])}
              disabled={colors.length >= 4}
              className={ACTION}
            >
              <Plus size={14} />
              Add
            </button>
          }
        >
          {colors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((color, i) => (
                <span
                  key={i}
                  className="group relative [animation:rise-in_200ms_ease-out]"
                >
                  <label
                    className="block size-9 cursor-pointer overflow-hidden rounded-full border border-line shadow-sm transition hover:scale-105"
                    style={{ background: color }}
                    title={color}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={(e) =>
                        setColors(
                          colors.map((c, j) => (j === i ? e.target.value : c)),
                        )
                      }
                      className="sr-only"
                      aria-label={`Colour ${i + 1}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setColors(colors.filter((_, j) => j !== i))}
                    aria-label={`Remove colour ${i + 1}`}
                    className="absolute -right-1 -top-1 hidden size-4 place-items-center rounded-full bg-ink text-white group-hover:grid group-focus-within:grid"
                  >
                    <X size={9} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Row>

        <Row
          title="Photos"
          done={kit.photos.length > 0}
          hint="Your place, products or team: photos you own or may use. Missing ones become labelled placeholders."
          action={
            <UploadButton
              label="Add"
              accept={IMAGES}
              multiple
              busy={busy === "photo"}
              onFiles={(f) => upload("photo", f)}
            />
          }
        >
          {kit.photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @2xl:grid-cols-4">
              {kit.photos.map((photo) => (
                <li
                  key={photo.file}
                  className="group relative overflow-hidden rounded-xl border border-line [animation:rise-in_200ms_ease-out]"
                >
                  <img
                    src={api.previewUrl(projectId, `brand/${photo.file}`)}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <select
                    value={photo.tag}
                    onChange={async (e) =>
                      onKitChange(
                        await api.tagDesignPhoto(
                          projectId,
                          photo.file,
                          e.target.value as PhotoTag,
                        ),
                      )
                    }
                    aria-label="Where to use this photo"
                    className="w-full border-t border-line bg-surface px-2 py-1.5 text-xs outline-none"
                  >
                    {TAGS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <RemoveButton
                      label="Remove photo"
                      onClick={() => remove("photo", photo.file)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Row>

        <Row
          title="Style"
          done={
            kit.references.length > 0 ||
            Boolean(styleNotes.trim() || avoid.trim())
          }
          hint="The feel you want, in your own words. Screenshots of sites you like help too (for mood only, never copied)."
          action={
            <UploadButton
              label="Screenshots"
              accept={IMAGES}
              multiple
              busy={busy === "reference"}
              onFiles={(f) => upload("reference", f)}
            />
          }
        >
          <div className="grid gap-3 @2xl:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted">
                I&apos;d like it to feel
              </span>
              <GrowingTextarea
                boxRef={notesRef}
                id="style-notes"
                value={styleNotes}
                onChange={setStyleNotes}
                placeholder="calm and minimal, lots of white space"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">
                Please avoid
              </span>
              <GrowingTextarea
                boxRef={avoidRef}
                id="style-avoid"
                value={avoid}
                onChange={setAvoid}
                placeholder="dark backgrounds, neon colours"
              />
            </label>
          </div>
          {kit.references.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {kit.references.map((ref) => (
                <li
                  key={ref}
                  className="group relative [animation:rise-in_200ms_ease-out]"
                >
                  <img
                    src={api.previewUrl(projectId, `.design-refs/${ref}`)}
                    alt=""
                    className="h-14 w-20 rounded-lg border border-line object-cover object-top"
                  />
                  <span className="absolute -right-1.5 -top-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <RemoveButton
                      label="Remove screenshot"
                      onClick={() => remove("reference", ref)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Row>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface">
        <DesignerCard
          engine={engine}
          onEngine={setEngine}
          stitch={stitch}
          onStitch={setStitch}
        />
      </div>

      <section className="mt-3 rounded-2xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        >
          <span>
            <span className="block text-sm font-medium">More options</span>
            <span className="block text-xs text-muted">
              A 3D model of your product.
            </span>
          </span>
          <CaretDown
            size={16}
            className={`shrink-0 text-muted transition-transform duration-200 ${more ? "rotate-180" : ""}`}
          />
        </button>
        {more && (
          <div className="divide-y divide-line border-t border-line [animation:rise-in_200ms_ease-out]">
            <Row
              title="3D model"
              done={Boolean(kit.model)}
              hint="Only if you have one: a .glb file from Blender, Spline or similar, up to 25 MB."
              action={
                <UploadButton
                  label={kit.model ? "Replace" : "Upload"}
                  accept=".glb,model/gltf-binary"
                  busy={busy === "model"}
                  onFiles={(f) => upload("model", f.slice(0, 1))}
                />
              }
            >
              {kit.model && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm [animation:rise-in_200ms_ease-out]">
                    <Cube size={18} className="text-accent" />
                    <span className="min-w-0 truncate font-medium">
                      {kit.model}
                    </span>
                    <TextButton onClick={() => remove("model", kit.model!)}>
                      Remove
                    </TextButton>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Switch checked={showcase} onChange={setShowcase} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        Show it on the home page
                      </span>
                      <span className="block text-xs leading-relaxed text-muted">
                        It turns as visitors scroll. People who turn animations
                        off see a still picture.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </Row>
          </div>
        )}
      </section>

      {onSkip && (
        <LandingSkipCard
          projectId={projectId}
          onSkip={skip}
          disabled={busy !== null}
          className="mt-3"
        />
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger [animation:rise-in_200ms_ease-out]"
        >
          {error}
        </p>
      )}

      <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 py-2.5 pl-5 pr-2.5 shadow-[0_8px_24px_-16px_rgba(14,27,44,0.35)] backdrop-blur">
        <p
          className={`min-w-0 text-sm text-muted ${stitchMissing ? "" : "hidden @lg:block"}`}
        >
          {stitchMissing ? (
            "Connect Google Stitch above, or choose Gagesite's designer."
          ) : summary.length ? (
            <>
              <span className="font-medium text-ink">Using your </span>
              {summary.join(", ")}.
            </>
          ) : (
            "Nothing added: Gagesite decides everything. That's fine."
          )}
        </p>
        <button
          onClick={start}
          disabled={busy !== null || stitchMissing}
          className="group ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "start" ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : null}
          Show me 3 styles
          <ArrowRight
            size={16}
            weight="bold"
            className="transition group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
}

const FIELD =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft";

/** The same look for every card's button. */
const ACTION =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition duration-200 hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink";

/**
 * Text boxes that grow with what is typed (up to the max height in their class, then they
 * scroll). Boxes sitting side by side keep the same height, so the row stays even.
 */
function useMatchedHeights(
  refs: React.RefObject<HTMLTextAreaElement | null>[],
  text: string,
) {
  useEffect(() => {
    const fit = () => {
      const boxes = refs
        .map((r) => r.current)
        .filter((b): b is HTMLTextAreaElement => !!b);
      for (const box of boxes) box.style.height = "auto";
      const natural = boxes.map((box) => box.scrollHeight + 2); // + the 1px borders
      const sameRow =
        boxes.length > 1 &&
        boxes.every((box) => box.offsetTop === boxes[0].offsetTop);
      boxes.forEach((box, i) => {
        box.style.height = `${sameRow ? Math.max(...natural) : natural[i]}px`;
      });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [refs, text]);
}

function GrowingTextarea({
  boxRef,
  id,
  value,
  onChange,
  placeholder,
}: {
  boxRef: React.RefObject<HTMLTextAreaElement | null>;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      ref={boxRef}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder={placeholder}
      className={`${FIELD} mt-1 block max-h-56 min-h-[4.25rem] resize-none overflow-y-auto pr-9 leading-relaxed [scrollbar-width:thin]`}
    />
  );
}

/**
 * Who draws the style options. Gagesite's own designer is the default; Google Stitch is an
 * extra: it draws the three styles, Gagesite still builds the design library from the chosen one.
 */
function DesignerCard({
  engine,
  onEngine,
  stitch,
  onStitch,
}: {
  engine: DesignEngine;
  onEngine: (engine: DesignEngine) => void;
  stitch: StitchStatus | null;
  onStitch: (status: StitchStatus) => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      onStitch(await api.connectStitch(key.trim()));
      setKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setError(null);
    try {
      onStitch(await api.disconnectStitch());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const options: {
    value: DesignEngine;
    title: string;
    text: string;
    tag?: string;
  }[] = [
    {
      value: "gagesite",
      title: "Gagesite's designer",
      tag: "Recommended",
      text: "Draws the three styles from your plan and what you added here. Nothing to set up.",
    },
    {
      value: "stitch",
      title: "Google Stitch",
      text: "Google's design AI draws the three styles; you still see and pick them here. Needs a free Stitch key and takes a few minutes longer.",
    },
  ];

  return (
    <section className="px-5 py-4">
      <h3 className="text-sm font-semibold leading-6">Who draws the styles</h3>
      <p className="text-[13px] leading-relaxed text-muted">
        Either way, Gagesite builds the final pages, so your website works the
        same.
      </p>
      <div
        role="radiogroup"
        aria-label="Who draws the styles"
        className="mt-3 grid gap-2 @2xl:grid-cols-2"
      >
        {options.map((o) => {
          const on = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onEngine(o.value)}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                on
                  ? "border-accent bg-accent-soft/40"
                  : "border-line hover:bg-surface-2"
              }`}
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                  on ? "border-accent" : "border-line-strong"
                }`}
              >
                {on && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {o.title}
                  {o.tag && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                      {o.tag}
                    </span>
                  )}
                  {o.value === "stitch" && stitch?.connected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Check size={10} weight="bold" /> Connected
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {o.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {engine === "stitch" && (
        <div className="mt-3 border-t border-line pt-3 [animation:rise-in_200ms_ease-out]">
          {stitch?.connected ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Check size={16} weight="bold" className="text-emerald-600" />
              <span>
                Google Stitch is connected (key ending{" "}
                <span className="font-mono">{stitch.hint}</span>). It&apos;s
                used for every project that chooses it.
              </span>
              <button
                type="button"
                onClick={disconnect}
                className="text-xs font-medium text-accent hover:underline"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Connect Google Stitch (once)
              </p>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-muted">
                <li>
                  Open{" "}
                  <a
                    href="https://stitch.withgoogle.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    stitch.withgoogle.com
                  </a>{" "}
                  and sign in with your Google account.
                </li>
                <li>
                  Click your profile picture, then Stitch settings, then API
                  key, and create a key.
                </li>
                <li>
                  Paste it below and press Connect. Gagesite checks it with
                  Google and keeps it encrypted.
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste your Stitch API key"
                  aria-label="Stitch API key"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy || !key.trim()}
                  className={ACTION}
                >
                  {busy ? (
                    <CircleNotch size={14} className="animate-spin" />
                  ) : null}
                  {busy ? "Checking..." : "Connect"}
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Your plan, colours and notes are sent to Google to draw the styles.
            If Stitch doesn&apos;t answer, Gagesite draws the styles itself.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * One line of the kit: its name (with a check once something is added) on the left, a short hint
 * or what was added in the middle, and its one button on the right.
 */
function Row({
  title,
  done,
  hint,
  action,
  children,
}: {
  title: string;
  done: boolean;
  hint: string;
  action: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hasBody = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  return (
    <section className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold leading-6">
            {title}
            {done && (
              <span className="grid size-4 place-items-center rounded-full bg-accent text-white [animation:rise-in_200ms_ease-out]">
                <Check size={10} weight="bold" aria-label="added" />
              </span>
            )}
          </h3>
          <p className="text-[13px] leading-relaxed text-muted">{hint}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {hasBody && <div className="mt-3">{children}</div>}
    </section>
  );
}

function TextButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-muted underline-offset-2 transition hover:text-danger hover:underline"
    >
      {children}
    </button>
  );
}

function UploadButton({
  label,
  accept,
  busy,
  multiple,
  onFiles,
}: {
  label: string;
  accept: string;
  busy: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={ACTION}
      >
        {busy ? (
          <CircleNotch size={14} className="animate-spin" />
        ) : (
          <UploadSimple size={14} />
        )}
        {busy ? "Uploading..." : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <span className="relative mt-0.5 inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="h-5 w-9 rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft" />
      <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-4" />
    </span>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg bg-surface/90 text-faint shadow-sm ring-1 ring-line transition hover:bg-danger-soft hover:text-danger hover:ring-danger/20 active:scale-95"
    >
      <Trash size={14} />
    </button>
  );
}
