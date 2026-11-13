"use client";

import {
  ArrowRight,
  CircleNotch,
  Cube,
  FilmStrip,
  Plus,
  Rocket,
  Sparkle,
  UploadSimple,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { api, type LandingStyle } from "@/lib/api";

const SHOWPIECES: {
  key: LandingStyle;
  icon: Icon;
  title: string;
  text: string;
}[] = [
  {
    key: "modern",
    icon: Sparkle,
    title: "Modern",
    text: "Layered visuals, real product screens, scroll motion",
  },
  {
    key: "3d",
    icon: Cube,
    title: "3D",
    text: "A live 3D scene that moves with the scroll",
  },
  {
    key: "video",
    icon: FilmStrip,
    title: "Video",
    text: "A full-screen clip that plays with the scroll",
  },
];

const FIELD =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft";

/**
 * A landing page's short brief: what the plan interview, the data design and UI Design would
 * otherwise gather, in about two minutes. Submitting it opens Implementation, where the Motion
 * Director storyboards the page.
 */
export default function LandingBrief({
  projectId,
  projectName,
  onDone,
}: {
  projectId: string;
  projectName: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    business_name: projectName,
    offer: "",
    main_action: "",
    main_action_link: "",
    facts: "",
    contact: "",
    location: "",
    languages: "English",
    link: "",
    style_note: "",
    prompt: "",
  });
  const [showpiece, setShowpiece] = useState<LandingStyle>("modern");
  const [colors, setColors] = useState<string[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // A brief already given: shown again, editable until the build starts.
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    api
      .getLandingBrief(projectId)
      .then(({ brief, suggested, locked: isLocked }) => {
        setLocked(isLocked);
        if (!brief && suggested) {
          setForm((current) => ({
            ...current,
            business_name: suggested.business_name || current.business_name,
            offer: suggested.offer || current.offer,
            location: suggested.location || current.location,
          }));
          if (suggested.location) setMore(true);
        }
        if (!brief) return;
        setSaved(true);
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(brief).filter(
              ([key, value]) => key in current && typeof value === "string",
            ),
          ),
          languages: (brief.languages ?? []).join(", ") || current.languages,
        }));
        setShowpiece(brief.showpiece ?? "modern");
        setColors(brief.colors ?? []);
        setMore(
          Boolean(
            brief.contact ||
            brief.location ||
            brief.link ||
            brief.style_note ||
            brief.prompt,
          ),
        );
      })
      .catch(() => undefined);
  }, [projectId]);
  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });
  const missing = [
    !form.business_name.trim() && "Business or product name",
    !form.offer.trim() && "What you offer",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;
  // A long prompt pasted into "What you offer" belongs in "A prompt or brief to follow".
  const offerLooksLikePrompt = form.offer.length > 500;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitLandingBrief(projectId, {
        ...form,
        languages: form.languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        showpiece,
        colors,
      });
      // The logo and photos go into the design kit the page is built from.
      if (logo) await api.uploadDesignFile(projectId, "logo", logo);
      for (const photo of photos)
        await api.uploadDesignFile(projectId, "photo", photo);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 [scrollbar-width:thin] md:px-8">
      <form onSubmit={submit} className="mx-auto max-w-2xl pb-10">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Rocket size={22} weight="duotone" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Your landing page brief
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {locked
            ? "Your page is being built from this brief. To change something now, ask for it in Implementation."
            : saved
              ? "Your brief. Change anything and press Update: the storyboard is then made again from it."
              : "About two minutes. This replaces the plan, data and design steps: Gagesite storyboards the page from it, you approve the storyboard, then it's built. Only the first two are needed."}
        </p>

        <fieldset
          disabled={locked}
          className="mt-6 space-y-4 disabled:opacity-70"
        >
          <Field label="Business or product name" required>
            <input
              value={form.business_name}
              onChange={set("business_name")}
              className={FIELD}
              maxLength={120}
            />
          </Field>
          <Field label="What you offer, in a sentence or two" required>
            <textarea
              value={form.offer}
              onChange={set("offer")}
              rows={3}
              maxLength={1500}
              placeholder="e.g. A small roastery in Seoul selling single-origin beans by subscription, delivered every two weeks."
              className={`${FIELD} resize-y`}
            />
            {offerLooksLikePrompt && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                This is long for a sentence or two
                {form.offer.length >= 1500
                  ? " and was cut at 1,500 characters"
                  : ""}
                . A full prompt fits better in{" "}
                <button
                  type="button"
                  onClick={() => setMore(true)}
                  className="font-medium text-accent-ink underline underline-offset-2"
                >
                  More → A prompt or brief to follow
                </button>
                ; keep a short description here.
              </p>
            )}
          </Field>
          <Field
            label="Key facts that must be exact (optional)"
            hint="Prices, hours, sizes, numbers: one per line."
          >
            <textarea
              value={form.facts}
              onChange={set("facts")}
              rows={4}
              maxLength={4000}
              placeholder={
                "e.g. 250 g bag 18,000 won\nFree delivery over 30,000 won\nRoasted every Monday"
              }
              className={`${FIELD} resize-y`}
            />
          </Field>
          <Field label="The showpiece at the top of the page">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
              {SHOWPIECES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={showpiece === s.key}
                  onClick={() => setShowpiece(s.key)}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                    showpiece === s.key
                      ? "border-accent bg-accent-soft/60"
                      : "border-line-strong hover:border-accent"
                  }`}
                >
                  <s.icon
                    size={17}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {s.title}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted">
                      {s.text}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <section className="rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setMore(!more)}
              aria-expanded={more}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">
                  More (all optional)
                </span>
                <span className="block text-xs text-muted">
                  Contact, languages, your current site, logo, colours, photos,
                  a style note or a prompt to follow
                </span>
              </span>
              <Plus
                size={16}
                className={`shrink-0 text-muted transition ${more ? "rotate-45" : ""}`}
              />
            </button>
            {more && (
              <div className="space-y-4 border-t border-line px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Contact">
                    <input
                      value={form.contact}
                      onChange={set("contact")}
                      className={FIELD}
                      placeholder="e.g. hello@... · 02-123-4567"
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      value={form.location}
                      onChange={set("location")}
                      className={FIELD}
                      placeholder="e.g. Seoul"
                    />
                  </Field>
                  <Field label="Languages">
                    <input
                      value={form.languages}
                      onChange={set("languages")}
                      className={FIELD}
                      placeholder="e.g. English, Korean"
                    />
                  </Field>
                  <Field label="Your current website">
                    <input
                      value={form.link}
                      onChange={set("link")}
                      className={FIELD}
                      placeholder="https://..."
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Logo">
                    <div className="flex h-9 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInput.current?.click()}
                        className={SMALL}
                      >
                        <UploadSimple size={14} /> {logo ? "Replace" : "Upload"}
                      </button>
                      {logo && (
                        <span className="min-w-0 truncate text-xs text-muted">
                          {logo.name}
                        </span>
                      )}
                      <input
                        ref={logoInput}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </Field>
                  <Field label="Colours">
                    <div className="flex h-9 items-center gap-2">
                      {colors.map((c, i) => (
                        <span key={i} className="group relative">
                          <label
                            className="block size-8 cursor-pointer rounded-full border border-line"
                            style={{ background: c }}
                          >
                            <input
                              type="color"
                              value={c}
                              className="sr-only"
                              aria-label={`Colour ${i + 1}`}
                              onChange={(e) =>
                                setColors(
                                  colors.map((x, j) =>
                                    j === i ? e.target.value : x,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            aria-label="Remove colour"
                            onClick={() =>
                              setColors(colors.filter((_, j) => j !== i))
                            }
                            className="absolute -right-1 -top-1 hidden size-4 place-items-center rounded-full bg-ink text-white group-hover:grid"
                          >
                            <X size={9} weight="bold" />
                          </button>
                        </span>
                      ))}
                      {colors.length < 4 && (
                        <button
                          type="button"
                          onClick={() => setColors([...colors, "#2266d4"])}
                          className={SMALL}
                        >
                          <Plus size={14} /> Add
                        </button>
                      )}
                    </div>
                  </Field>
                  <Field label="Photos">
                    <div className="flex h-9 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => photoInput.current?.click()}
                        className={SMALL}
                      >
                        <UploadSimple size={14} /> Add
                      </button>
                      {photos.length > 0 && (
                        <span className="text-xs text-muted">
                          {photos.length} added
                        </span>
                      )}
                      <input
                        ref={photoInput}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) =>
                          setPhotos(
                            [
                              ...photos,
                              ...Array.from(e.target.files ?? []),
                            ].slice(0, 12),
                          )
                        }
                      />
                    </div>
                  </Field>
                </div>
                <Field label="The feel you want">
                  <input
                    value={form.style_note}
                    onChange={set("style_note")}
                    className={FIELD}
                    placeholder="e.g. Calm and premium, lots of white space"
                    maxLength={1000}
                  />
                </Field>
                <Field
                  label="A prompt or brief to follow"
                  hint="Paste one you already have. It guides the look, layout and motion; your facts above are used for the content."
                >
                  <textarea
                    value={form.prompt}
                    onChange={set("prompt")}
                    rows={6}
                    maxLength={20000}
                    className={`${FIELD} resize-y font-mono text-xs`}
                  />
                </Field>
              </div>
            )}
          </section>
        </fieldset>

        {!locked && !ready && (
          <p className="mt-6 text-center text-xs text-muted">
            To continue, fill in:{" "}
            <span className="font-medium text-ink">{missing.join(", ")}</span>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {locked ? (
          <button
            type="button"
            onClick={onDone}
            className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong px-6 font-semibold transition hover:border-accent hover:text-accent-ink"
          >
            Go to Implementation
            <ArrowRight
              size={18}
              weight="bold"
              className="transition group-hover:translate-x-0.5"
            />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!ready || busy}
            className={`group ${ready ? "mt-6" : "mt-2"} inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 font-semibold text-white transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50`}
          >
            {busy ? <CircleNotch size={18} className="animate-spin" /> : null}
            {busy
              ? "Setting up your page..."
              : saved
                ? "Update the brief"
                : "Continue to the storyboard"}
            <ArrowRight
              size={18}
              weight="bold"
              className="transition group-hover:translate-x-0.5"
            />
          </button>
        )}
      </form>
    </div>
  );
}

const SMALL =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-medium transition hover:border-accent hover:text-accent-ink active:scale-[0.98]";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
