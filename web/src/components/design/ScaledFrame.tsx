"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

const PREVIEW_ORIGIN = new URL(API_URL).origin;

/** One part of the page a comment can be about, e.g. a button, a card or the whole section. */
export interface PickTarget {
  selector: string;
  label: string;
  tag: string;
  /** Plain name for the owner: "Button", "Card", "Section"... */
  kind: string;
}

export interface PickEvent {
  selector: string;
  label: string;
  tag: string;
  /** The clicked part first, then the bigger parts around it, ending with the section. */
  chain: PickTarget[];
  /** Click position in the box's own pixels (already scaled). */
  x: number;
  y: number;
}

/**
 * Shows a mockup at a real device width, scaled down to fit its box.
 *
 * Mockups are generated HTML in a sandboxed iframe. They need `allow-same-origin` because the
 * Tailwind Play CDN and web fonts fail in an opaque origin. That is only safe because previews
 * are served by the backend, a DIFFERENT origin from this app, so a mockup can never reach the
 * app's page. In production, keep previews on their own domain (never the app's origin).
 *
 * In pick mode the backend injects a picker script; it reports clicked sections here and draws
 * numbered pins for `marks` (the parent can't touch the cross-origin page directly).
 */
export default function ScaledFrame({
  src,
  title,
  deviceWidth = 1280,
  interactive = true,
  version,
  pick = false,
  marks,
  onPick,
  messages,
  autoHeight = false,
  onFrameMessage,
  transparent = false,
}: {
  src: string;
  title: string;
  deviceWidth?: number;
  interactive?: boolean;
  /** Changing this reloads the frame (e.g. after Claude edits the file). */
  version?: string | number;
  pick?: boolean;
  marks?: { n: number; selector: string }[];
  onPick?: (event: PickEvent) => void;
  /** Posted to the page's injected script, e.g. { type: "gs-show", id } to switch components without reloading. */
  messages?: Record<string, unknown>[];
  /** Size the frame to the page's reported content height (the isolate script sends it). */
  autoHeight?: boolean;
  /** Any other message from the page's injected script (e.g. a gallery card was clicked). */
  onFrameMessage?: (data: Record<string, unknown>) => void;
  /** Let the page's own (transparent) background show through, e.g. for the component gallery. */
  transparent?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = box.width ? Math.min(1, box.width / deviceWidth) : 0;
  const frameWidth = scale < 1 ? deviceWidth : box.width;

  // Pins and the "show this section" message are sent whenever they change, and again when the
  // injected script announces it is ready (the frame may still be loading on the first send).
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const sendToFrame = useCallback(() => {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    if (marksRef.current) target.postMessage({ type: "gs-marks", marks: marksRef.current }, PREVIEW_ORIGIN);
    for (const message of messagesRef.current ?? []) target.postMessage(message, PREVIEW_ORIGIN);
  }, []);
  const messageKey = JSON.stringify(messages ?? null);
  useEffect(sendToFrame, [marks, messageKey, sendToFrame]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PREVIEW_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "gs-ready") sendToFrame();
      if (event.data && typeof event.data === "object") onFrameMessage?.(event.data);
      if (event.data?.type === "gs-size" && typeof event.data.height === "number") setContentHeight(event.data.height);
      if (event.data?.type === "gs-pick" && pick && onPick) {
        const { selector, label, tag, x, y, chain } = event.data;
        const parts: PickTarget[] = Array.isArray(chain) && chain.length ? chain : [{ selector, label, tag, kind: tag }];
        onPick({ selector, label, tag, chain: parts, x: x * scale, y: y * scale });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pick, onPick, onFrameMessage, scale, sendToFrame]);

  // Keep a #fragment (jump to a section) after the query string.
  const [base, hash = ""] = src.split("#");
  const query = [version !== undefined ? `v=${version}` : "", pick ? "pick=1" : ""].filter(Boolean).join("&");
  const joiner = base.includes("?") ? "&" : "?";
  const url = `${base}${query ? `${joiner}${query}` : ""}${hash ? `#${hash}` : ""}`;

  return (
    <div
      ref={boxRef}
      className={`relative w-full overflow-hidden ${autoHeight ? "" : "h-full"}`}
      style={autoHeight ? { height: Math.max(120, contentHeight * (scale || 1)) } : undefined}
    >
      {scale > 0 && (
        <iframe
          ref={frameRef}
          key={`${src}-${version ?? ""}-${pick}`}
          src={url}
          title={title}
          sandbox="allow-scripts allow-same-origin"
          loading={autoHeight ? "eager" : "lazy"}
          className={`absolute left-0 top-0 origin-top-left border-0 ${transparent ? "bg-transparent" : "bg-white"} ${interactive ? "" : "pointer-events-none"}`}
          style={{
            width: frameWidth,
            height: autoHeight ? Math.max(120, contentHeight) : box.height / scale,
            transform: `scale(${scale})`,
          }}
        />
      )}
      {autoHeight && contentHeight === 0 && (
        <div className="absolute inset-0 animate-pulse bg-surface-2/80" aria-label="Loading preview" />
      )}
    </div>
  );
}
