"use client";

import { ArrowSquareOut, CheckCircle, CircleNotch, LockSimple, Triangle } from "@phosphor-icons/react";
import { useState } from "react";
import { api, type VercelInfo } from "@/lib/api";

const SIGNUP_URL = "https://vercel.com/signup";
const TOKEN_URL = "https://vercel.com/account/settings/tokens";

/** The owner's own Vercel account: where their website goes online. */
export default function VercelConnect({
  projectId,
  vercel,
  onChange,
  disabled = false,
}: {
  projectId: string;
  vercel: VercelInfo | null;
  onChange: (vercel: VercelInfo | null) => void;
  /** True while the website is going online (the account can't change mid-way). */
  disabled?: boolean;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.connectVercel(projectId, token.trim()));
      setToken("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api.disconnectVercel(projectId);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  if (vercel) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-500" />
        <p className="min-w-0 flex-1 text-sm">
          Connected to <span className="font-semibold">{vercel.username}</span> on Vercel
        </p>
        <button
          onClick={disconnect}
          disabled={busy || disabled}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (token.trim()) connect();
      }}
    >
      <p className="text-sm leading-relaxed text-muted">
        Vercel is the service that keeps your website online. It runs in <span className="font-medium text-ink">your own</span>{" "}
        account, so the website stays yours even without Gagesite.
      </p>
      <ol className="mt-3 space-y-2.5 text-sm leading-relaxed">
        <Step n="a">
          No account yet?{" "}
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink hover:underline">
            Sign up at Vercel <ArrowSquareOut size={11} className="inline" />
          </a>
          . Continuing with GitHub is quickest.
        </Step>
        <Step n="b">
          <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink hover:underline">
            Open Vercel&apos;s token page <ArrowSquareOut size={11} className="inline" />
          </a>{" "}
          and create a token: name it <span className="font-medium text-ink">Gagesite</span>, choose your own account as the
          scope, and an expiry you&apos;re comfortable with.
        </Step>
        <Step n="c">
          Copy the token and paste it here:
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Vercel token"
              spellCheck={false}
              autoComplete="off"
              aria-label="Vercel token"
              className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
            <button
              disabled={busy || disabled || !token.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:bg-line-strong"
            >
              {busy ? <CircleNotch size={15} className="animate-spin" /> : <Triangle size={13} weight="fill" />}
              {busy ? "Checking..." : "Connect Vercel"}
            </button>
          </div>
        </Step>
      </ol>
      {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
        <LockSimple size={13} className="mt-px shrink-0" />
        The token is stored encrypted and only used to put this website online. You can delete it on Vercel any time.
      </p>
    </form>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5">
      <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-surface text-xs font-bold text-accent-ink ring-1 ring-accent/30">
        {n}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
