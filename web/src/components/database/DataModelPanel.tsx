"use client";

import {
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle,
  Code,
  Copy,
  Database,
  FileText,
  PencilSimple,
  TreeStructure,
  X,
  type Icon,
} from "@phosphor-icons/react";
import ConnectSheet from "@/components/database/ConnectSheet";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DataBrowser, { tablesWithData, useDataOverview } from "@/components/database/DataBrowser";
import DataView from "@/components/database/DataView";
import ErdDiagram from "@/components/database/ErdDiagram";
import TablesView from "@/components/database/TablesView";
import { changeKey, changesMessage, describeChange, queueChange, type TableChange } from "@/components/database/tableChanges";
import ApprovalBar from "@/components/stage/ApprovalBar";
import EmptyCard from "@/components/stage/EmptyCard";
import type { DatabaseArtifact, DbConnection } from "@/lib/api";

type Tab = "diagram" | "tables" | "data" | "summary" | "code";

export default function DataModelPanel({
  projectId,
  artifact,
  approved,
  approvedAt,
  connection,
  connectFocus,
  running,
  busy,
  onApprove,
  onReopen,
  onConnectionChange,
  onAsk,
}: {
  projectId: string;
  artifact: DatabaseArtifact | null;
  approved: boolean;
  approvedAt: string | null;
  connection: DbConnection | null;
  /** Bumped by the parent to open the Connect sheet (right after approval). */
  connectFocus: number;
  running: boolean;
  busy: boolean;
  onApprove: () => void;
  onReopen: () => void;
  onConnectionChange: (connection: DbConnection | null) => void;
  /** Sends a message to Gagesite (used to apply the owner's queued table edits). */
  onAsk?: (message: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<Tab>("diagram");
  // Small edits the owner queued on the drafted tables; Gagesite applies them together.
  const [changes, setChanges] = useState<TableChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  useEffect(() => {
    if (connectFocus) setConnectOpen(true);
  }, [connectFocus]);
  const schema = artifact?.data ?? null;
  const hasTables = (schema?.tables.length ?? 0) > 0;
  // Row counts per table, loaded once for the Data tab and its badge.
  // Bumped after an import, so row counts reload.
  const [dataVersion, setDataVersion] = useState(0);
  const data = useDataOverview(
    projectId,
    hasTables ? `${artifact?.prisma?.length}-${connection?.tested_at}-${dataVersion}` : null,
  );
  const hasData = !!data.overview && tablesWithData(data.overview).length > 0;
  // The "fix before import" count only means something when there is data to import.
  const issueCount = hasData ? (schema?.data_issues.filter((i) => i.severity === "warning").length ?? 0) : 0;
  // A simple site without a database: no diagram, tables or data, just where the content lives.
  const simple = schema?.mode === "none";
  // Owner edits only on a draft Gagesite isn't busy with (approved designs are reopened first).
  const canEdit = !approved && !running && !simple && !!onAsk;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "diagram", label: "Diagram" },
    { key: "tables", label: "Tables", badge: schema?.tables.length },
    { key: "data", label: "Data", badge: issueCount || undefined },
  ];
  // The written summary repeats the tabs in plain words, and the code is for developers:
  // both stay one click away as small icons, like the plan in Stage 1.
  const extras: { key: Tab; label: string; icon: Icon }[] = [
    { key: "summary", label: "Summary document", icon: FileText },
    { key: "code", label: "Code (Prisma schema)", icon: Code },
  ];

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-lg font-bold tracking-tight">{simple ? "Your content" : "Data model"}</h2>
          {running && <span className="text-xs text-accent-ink">Gagesite is working...</span>}
        </div>
        {!simple && (
          <div className="flex overflow-x-auto rounded-xl bg-surface-2 p-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      t.key === "data" ? "bg-amber-100 text-amber-800" : "bg-accent-soft text-accent-ink"
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
            <span className="mx-1 my-1 w-px bg-line-strong" aria-hidden />
            {extras.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                aria-label={t.label}
                title={t.label}
                onClick={() => setTab(t.key)}
                className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${
                  tab === t.key ? "bg-surface text-ink shadow-sm" : "text-faint hover:text-ink"
                }`}
              >
                <t.icon size={15} />
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        className={`relative min-h-0 flex-1 overflow-y-auto px-6 pb-6 ${tab === "diagram" && hasTables ? "flex flex-col" : ""}`}
      >
        {artifact && artifact.errors.length > 0 && (
          <div className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="font-medium">The design file has problems Gagesite still needs to fix:</p>
            <ul className="mt-1 list-disc pl-5">
              {artifact.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {artifact === null ? (
          <div className="h-full min-h-[420px] animate-pulse rounded-3xl bg-surface-2" aria-label="Loading design" />
        ) : simple && schema ? (
          <SimpleSite schema={schema} />
        ) : tab === "data" ? (
          // Before there are tables, the old view still explains what an upload is for.
          hasTables ? (
            <DataBrowser
              projectId={projectId}
              overview={data.overview}
              error={data.error}
              onImported={() => setDataVersion((v) => v + 1)}
            />
          ) : artifact.profile.length ? (
            <DataView profile={artifact.profile} schema={schema} />
          ) : (
            <EmptyCard
              icon={Database}
              title={running ? "Gagesite is drawing your design..." : "No data yet"}
              text="Your rows show here once the design has tables, from your uploaded files or your connected database."
            />
          )
        ) : !hasTables || !schema ? (
          <EmptyModel running={running} />
        ) : tab === "diagram" ? (
          <div className="min-h-0 flex-1">
            <ErdDiagram schema={schema} />
          </div>
        ) : tab === "tables" ? (
          <>
            {canEdit && changes.length === 0 && (
              <p className="mb-4 flex items-center gap-1.5 text-xs text-faint">
                <PencilSimple size={13} className="text-accent" />
                Hover a field (on a phone, use the buttons under it) to rename it, remove it or make it optional, or add a new
                one. Changes are applied together.
              </p>
            )}
            <TablesView
              schema={schema}
              changes={changes}
              onQueue={canEdit ? (c) => setChanges((all) => queueChange(all, c)) : undefined}
              onUndo={(c) => setChanges((all) => all.filter((x) => changeKey(x) !== changeKey(c)))}
            />
          </>
        ) : tab === "summary" ? (
          artifact.markdown ? (
            <div className="prose-doc text-[15px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.markdown}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted">Gagesite writes a plain-language summary once the design is ready.</p>
          )
        ) : (
          <CodeView prisma={artifact.prisma} />
        )}
      </div>

      {approved && !simple && (
        <button
          onClick={() => setConnectOpen(true)}
          className="group flex items-center gap-2.5 border-t border-line px-6 py-3 text-left text-sm transition hover:bg-surface-2"
        >
          {connection ? (
            <>
              <CheckCircle size={18} weight="fill" className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-muted">
                Data will live in your <span className="font-medium capitalize text-ink">{connection.provider}</span> database
              </span>
            </>
          ) : (
            <>
              <Database size={18} weight="duotone" className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 text-muted">
                <span className="font-semibold text-ink">Next:</span> choose where your website&apos;s data will live
              </span>
            </>
          )}
          <ArrowRight size={16} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>
      )}

      {changes.length > 0 && (
        <div className="border-t border-line bg-surface px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {changes.length} change{changes.length === 1 ? "" : "s"} to apply
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChanges([])}
                disabled={applying}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                Discard
              </button>
              <button
                onClick={async () => {
                  if (!onAsk) return;
                  setApplying(true);
                  if (await onAsk(changesMessage(changes, schema))) setChanges([]);
                  setApplying(false);
                }}
                disabled={applying || running || !onAsk}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
              >
                Apply {changes.length === 1 ? "change" : `${changes.length} changes`}
                <ArrowUp size={12} weight="bold" />
              </button>
            </div>
          </div>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {changes.map((c) => (
              <li key={changeKey(c)} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1">{describeChange(c, schema)}</span>
                <button
                  onClick={() => setChanges((all) => all.filter((x) => changeKey(x) !== changeKey(c)))}
                  aria-label="Remove this change"
                  className="text-faint hover:text-danger"
                >
                  <X size={12} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ApprovalBar
        approved={approved}
        approvedAt={approvedAt}
        // A complete, valid design can be approved without waiting for Gagesite to mark it ready.
        ready={artifact?.approvable ?? artifact?.ready ?? false}
        openCount={schema?.open_questions.length ?? 0}
        running={running}
        busy={busy}
        approveLabel="Approve design"
        approvedLabel="Design approved"
        readyHint="Approving unlocks UI design."
        draftHint="Gagesite marks the design ready once you're happy with it."
        message={
          artifact?.approvable && !artifact.ready ? (
            <>
              <span className="font-semibold text-ink">You can approve this design now.</span> If anything should change,
              ask in the chat first.
            </>
          ) : undefined
        }
        onApprove={onApprove}
        onReopen={onReopen}
      />

      <ConnectSheet
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        projectId={projectId}
        approved={approved}
        connection={connection}
        onConnectionChange={onConnectionChange}
      />
    </section>
  );
}

/** "content/opening-hours.json" -> "Opening hours"; the site file is the business details. */
function contentName(file: string) {
  const base =
    file
      .split("/")
      .pop()
      ?.replace(/\.[a-z]+$/i, "") ?? file;
  if (base === "site") return "Business details";
  const words = base.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A site without a database, in the owner's terms: what the site carries, what arrives by email, what the plan loses. */
function SimpleSite({ schema }: { schema: NonNullable<DatabaseArtifact["data"]> }) {
  const files = schema.content_files ?? [];
  const forms = schema.email_forms ?? [];
  const leftOut = schema.left_out ?? [];
  return (
    <div className="space-y-8 pt-1 text-sm">
      <div className="rounded-2xl bg-accent-soft px-4 py-3 leading-relaxed text-accent-ink">
        <span className="font-semibold">No database: a simple site.</span> Your content is part of the website, forms arrive by
        email, and there is no admin page. To add a database later, reopen this step and start over.
      </div>

      {files.length > 0 && (
        <section>
          <h3 className="mb-2.5 font-display text-[15px] font-bold tracking-tight">What&apos;s on your website</h3>
          <ul className="divide-y divide-line border-y border-line">
            {files.map((f) => (
              <li key={f.file} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                <span className="font-medium">{contentName(f.file)}</span>
                <span className="leading-relaxed text-muted">{f.holds}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {forms.length > 0 && (
        <section>
          <h3 className="mb-2.5 font-display text-[15px] font-bold tracking-tight">What arrives by email</h3>
          <ul className="divide-y divide-line border-y border-line">
            {forms.map((f) => (
              <li key={f.form} className="py-2.5">
                <p className="font-medium">
                  {f.form}
                  {f.to && <span className="font-normal text-muted">, sent to {f.to}</span>}
                </p>
                {f.note && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{f.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {leftOut.length > 0 && (
        <section>
          <h3 className="mb-2.5 font-display text-[15px] font-bold tracking-tight">Not included from your plan</h3>
          <ul className="divide-y divide-line border-y border-line">
            {leftOut.map((item) => (
              <li key={item} className="py-2.5 leading-relaxed text-muted">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!files.length && <p className="text-muted">Gagesite is working out what your website carries.</p>}
    </div>
  );
}

function EmptyModel({ running }: { running: boolean }) {
  return (
    <EmptyCard
      icon={TreeStructure}
      title={running ? "Gagesite is drawing your design..." : "Your diagram appears here"}
      text="Each box is a list the site keeps, like customers or bookings. Lines show how they connect."
    />
  );
}

function CodeView({ prisma }: { prisma: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!prisma) return <p className="text-sm text-muted">The code version appears once the design has tables.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">The same design as a Prisma schema. The build step uses this file.</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(prisma);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition hover:border-accent hover:text-accent-ink"
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl bg-[#0e1b2c] p-5 font-mono text-xs leading-relaxed text-sky-100">{prisma}</pre>
    </div>
  );
}
