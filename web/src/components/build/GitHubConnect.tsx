"use client";

import { ArrowSquareOut, CheckCircle, CircleNotch, CloudArrowUp, GithubLogo, LockSimple, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { api, type GitHubInfo } from "@/lib/api";

const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

function when(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Asks the owner to connect their own GitHub repository: the website's code is saved there after
 * every build round, so they own it and can host it anywhere. The token goes straight to the
 * server, which checks it and keeps it encrypted.
 */
export default function GitHubConnect({
  projectId,
  github,
  onChange,
  bare = false,
  suggestedName = "",
  canPush = true,
}: {
  projectId: string;
  github: GitHubInfo | null;
  onChange: (github: GitHubInfo | null) => void;
  /** Without its own card and heading (inside a step that already says what it is). */
  bare?: boolean;
  /** A repository name to suggest, e.g. "crystal-bank" from the business name. */
  suggestedName?: string;
  /** False while Gagesite is working (saving waits until it's done). */
  canPush?: boolean;
}) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"connect" | "push" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "connect" | "push" | "disconnect") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "connect") {
        onChange(await api.connectGitHub(projectId, repo, token));
        setToken("");
      } else if (kind === "push") {
        onChange(await api.pushGitHub(projectId));
      } else {
        await api.disconnectGitHub(projectId);
        onChange(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (github) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Saved to your GitHub</p>
            <a
              href={github.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 truncate text-sm text-accent-ink hover:underline"
            >
              {github.repo} <ArrowSquareOut size={12} />
            </a>
            <p className="mt-1 text-xs text-muted">
              {github.last_push_at
                ? `Last saved ${when(github.last_push_at)}${github.last_commit ? ` (version ${github.last_commit})` : ""}`
                : "Nothing saved yet: Gagesite saves the code after each building round."}
            </p>
          </div>
        </div>
        {(github.last_error || error) && (
          <p className="mt-3 flex gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
            {error ?? github.last_error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => act("push")}
            disabled={!!busy || !canPush}
            title={canPush ? "Save the current code to GitHub now" : "Gagesite saves when it finishes this round"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
          >
            {busy === "push" ? <CircleNotch size={15} className="animate-spin" /> : <CloudArrowUp size={15} weight="bold" />}
            Save now
          </button>
          <button
            onClick={() => act("disconnect")}
            disabled={!!busy}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (repo.trim() && token.trim()) act("connect");
      }}
      className={bare ? "" : "rounded-3xl border border-line bg-surface p-5"}
    >
      {!bare && (
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink text-white">
            <GithubLogo size={22} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Connect your GitHub</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              Your website&apos;s code is saved in your own GitHub account after every building round, so it&apos;s yours and you
              can put it online anywhere.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted">
        GitHub keeps your website&apos;s code in a <span className="font-medium text-ink">repository</span>: a folder in your
        GitHub account that only you can see. After every building round, Gagesite saves a new version there, so you always have
        the latest code and its full history.
      </p>

      <ol className="mt-5 space-y-5">
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
          <StepNumber n="a" />
          <div>
            <label htmlFor="gh-repo" className="block text-sm font-semibold">
              Name the folder for your code
            </label>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              Your GitHub username, a slash, then a name for the website. If it doesn&apos;t exist yet, Gagesite creates it for
              you, as private.
            </p>
            <input
              id="gh-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder={`your-github-name/${suggestedName || "my-website"}`}
              spellCheck={false}
              autoComplete="off"
              className="mt-2 w-full max-w-md rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
          </div>
        </li>

        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
          <StepNumber n="b" />
          <div>
            <label htmlFor="gh-token" className="block text-sm font-semibold">
              Give Gagesite a key to save there
            </label>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              GitHub calls this key a <span className="font-medium text-ink">token</span>.{" "}
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-ink hover:underline"
              >
                Open GitHub&apos;s token page <ArrowSquareOut size={11} className="inline" />
              </a>{" "}
              and fill it in like this:
            </p>
            <ul className="mt-2 space-y-1 rounded-xl bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-muted ring-1 ring-line">
              <li>
                <span className="font-medium text-ink">Token name:</span> Gagesite
              </li>
              <li>
                <span className="font-medium text-ink">Repository access:</span> All repositories (or, if the folder already
                exists, only that one)
              </li>
              <li>
                <span className="font-medium text-ink">Permissions:</span> Contents: Read and write, and Administration: Read and
                write (only needed so Gagesite can create the folder)
              </li>
              <li>
                Press <span className="font-medium text-ink">Generate token</span>, copy it and paste it here:
              </li>
            </ul>
            <input
              id="gh-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              spellCheck={false}
              autoComplete="off"
              className="mt-2 w-full max-w-md rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
          </div>
        </li>
      </ol>

      {error && <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
          <LockSimple size={13} className="mt-px shrink-0" />
          The key is stored encrypted and only used to save your code. You can delete it on GitHub any time.
        </p>
        <button
          disabled={!!busy || !repo.trim() || !token.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:bg-line-strong"
        >
          {busy === "connect" ? <CircleNotch size={15} className="animate-spin" /> : <GithubLogo size={15} weight="fill" />}
          {busy === "connect" ? "Checking..." : "Connect GitHub"}
        </button>
      </div>
    </form>
  );
}

function StepNumber({ n }: { n: string }) {
  return (
    <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-surface text-xs font-bold text-accent-ink ring-1 ring-accent/30">
      {n}
    </span>
  );
}
