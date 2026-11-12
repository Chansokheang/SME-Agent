"use client";

/* eslint-disable @next/next/no-img-element -- the owner's uploads, served by our backend */

import { ChatCircleText, Cube, Image as ImageIcon, Images, Palette, Prohibit, Sparkle, type Icon } from "@phosphor-icons/react";
import { api, type DesignKit, type PhotoTag } from "@/lib/api";

const TAG_LABEL: Record<PhotoTag, string> = {
  hero: "Top of home page",
  menu: "Menu / products",
  about: "About us",
  gallery: "Gallery",
  other: "Gagesite decides",
};

/** What the owner gave Stage 3 at the start, read-only, so they can check it while choosing. */
export default function KitSummary({ projectId, kit }: { projectId: string; kit: DesignKit | null }) {
  if (!kit) return <div className="h-80 animate-pulse rounded-2xl bg-surface-2" aria-label="Loading your input" />;
  const nothing =
    !kit.logo && !kit.colors.length && !kit.photos.length && !kit.references.length && !kit.style_notes && !kit.avoid && !kit.model;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        What you gave Gagesite before it designed. Every style follows it.
        {nothing && " You left everything empty, so Gagesite chose the look itself."}
      </p>

      <div className="grid gap-3 @2xl:grid-cols-2">
        <Row icon={Palette} title="Colours" empty="None: Gagesite picked a palette">
          {kit.colors.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {kit.colors.map((color) => (
                <span key={color} className="flex items-center gap-2 text-xs">
                  <span className="size-8 rounded-lg border border-line shadow-sm" style={{ background: color }} />
                  <span className="font-mono uppercase text-muted">{color}</span>
                </span>
              ))}
            </div>
          )}
        </Row>
        <Row icon={ImageIcon} title="Logo" empty="None: Gagesite uses a wordmark of your name">
          {kit.logo && (
            <img
              src={api.previewUrl(projectId, `brand/${kit.logo}`)}
              alt="Your logo"
              className="h-12 max-w-[200px] rounded-md bg-white object-contain p-1 ring-1 ring-line"
            />
          )}
        </Row>
      </div>

      <Row icon={Sparkle} title="Describe it" empty="Nothing written">
        {kit.style_notes && <p className="whitespace-pre-wrap text-sm leading-relaxed">{kit.style_notes}</p>}
      </Row>
      <Row icon={Prohibit} title="Things to avoid" empty="Nothing listed">
        {kit.avoid && <p className="whitespace-pre-wrap text-sm leading-relaxed">{kit.avoid}</p>}
      </Row>

      <Row icon={Images} title="Photos" empty="None: Gagesite uses openly licensed photos and labelled placeholders">
        {kit.photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 @2xl:grid-cols-5">
            {kit.photos.map((photo) => (
              <li key={photo.file} className="overflow-hidden rounded-lg border border-line">
                <img src={api.previewUrl(projectId, `brand/${photo.file}`)} alt="" className="aspect-[4/3] w-full object-cover" />
                <p className="truncate px-2 py-1 text-[11px] text-muted">{TAG_LABEL[photo.tag] ?? photo.tag}</p>
              </li>
            ))}
          </ul>
        )}
      </Row>

      {kit.references.length > 0 && (
        <Row icon={ImageIcon} title="Sites you like" empty="">
          <ul className="flex flex-wrap gap-2">
            {kit.references.map((ref) => (
              <li key={ref}>
                <img
                  src={api.previewUrl(projectId, `.design-refs/${ref}`)}
                  alt=""
                  className="h-16 w-24 rounded-md border border-line object-cover object-top"
                />
              </li>
            ))}
          </ul>
        </Row>
      )}

      {kit.model && (
        <Row icon={Cube} title="3D model" empty="">
          <p className="text-sm">
            {kit.model} · 3D showcase on the home page: <span className="font-medium">{kit.showcase_3d ? "on" : "off"}</span>
          </p>
        </Row>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
        <ChatCircleText size={15} className="mt-px shrink-0 text-accent" />
        To change any of this, tell Gagesite in the chat, for example &ldquo;use #1f3a5f as the main colour&rdquo; or
        &ldquo;avoid dark backgrounds&rdquo;.
      </p>
    </div>
  );
}

function Row({ icon: RowIcon, title, empty, children }: { icon: Icon; title: string; empty: string; children?: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <RowIcon size={14} className="text-accent" />
        {title}
      </h3>
      <div className="mt-2.5">{hasContent ? children : <p className="text-sm text-faint">{empty}</p>}</div>
    </section>
  );
}
