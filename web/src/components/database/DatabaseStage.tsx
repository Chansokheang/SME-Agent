"use client";

import { CircleNotch, FileArrowUp, TreeStructure, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import DataModelPanel from "@/components/database/DataModelPanel";
import DataStart, { type Choice } from "@/components/database/DataStart";
import ChatColumn from "@/components/stage/ChatColumn";
import ConfirmDialog from "@/components/stage/ConfirmDialog";
import { StartOverTrigger } from "@/components/stage/StartOverButton";
import StageLayout from "@/components/stage/StageLayout";
import StartPanel, { ChatGreeting } from "@/components/stage/StartPanel";
import {
  api,
  type DatabaseArtifact,
  type DbConnection,
  type FileProfile,
  type Scope,
  type SourceDb,
  type StageInfo,
} from "@/lib/api";
import { useStageRun } from "@/lib/useStageRun";

const STAGE = "02-database";

function describeUploads(uploads: FileProfile[]) {
  return uploads
    .filter((u) => !u.error)
    .map((u) => (u.sheets.length ? `${u.file} (${u.sheets.map((s) => s.name).join(", ")})` : u.file))
    .join("; ");
}

export default function DatabaseStage({
  projectId,
  stage,
  activeRunId,
  onStageChange,
  onApproved,
}: {
  projectId: string;
  stage: StageInfo;
  activeRunId: string | null;
  onStageChange: () => void;
  /** After approving: go on to the next stage. */
  onApproved?: () => void;
}) {
  const [artifact, setArtifact] = useState<DatabaseArtifact | null>(null);
  const [uploads, setUploads] = useState<FileProfile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Files added after the conversation started, which Claude hasn't been told about yet.
  const [unannounced, setUnannounced] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [connectFocus, setConnectFocus] = useState(0);
  // The plan's advice on whether this site needs a database at all.
  const [advice, setAdvice] = useState<Scope["data_storage"]>();
  // The owner's existing database, connected read-only to design around.
  const [source, setSource] = useState<SourceDb | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const loadArtifact = useCallback(() => {
    api.getDatabase(projectId).then(setArtifact);
  }, [projectId]);
  useEffect(() => {
    loadArtifact();
    api.listUploads(projectId).then(setUploads);
    api.getConnection(projectId).then(setConnection);
    api
      .getSourceDatabase(projectId)
      .then(setSource)
      .catch(() => undefined);
    api
      .getScope(projectId)
      .then((s) => setAdvice(s.data?.data_storage))
      .catch(() => undefined);
  }, [loadArtifact, projectId]);

  const run = useStageRun({
    projectId,
    stageKey: STAGE,
    activeRunId,
    onArtifactChange: loadArtifact,
    onDone: onStageChange,
  });
  const approved = stage.status === "approved";
  // A skipped step (no database) has a design but no conversation: show it, not the choices.
  const skipped = artifact?.data?.mode === "none" && run.messages.length === 0;
  // Stopped before anything was designed: the start choices come back (uploads are kept).
  const started = run.running || skipped || (run.messages.length > 0 && (artifact === null || artifact.exists));

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      let latest = uploads;
      for (const file of files) latest = await api.uploadFile(projectId, file);
      setUploads(latest);
      loadArtifact();
      if (started) setUnannounced((names) => [...new Set([...names, ...files.map((f) => f.name)])]);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(file: string) {
    setUploads(await api.deleteUpload(projectId, file));
    loadArtifact();
  }

  async function start(choice: Choice) {
    if (choice === "none") {
      // Nothing to design: the simple-site design is written from the plan and this step is approved.
      setBusy(true);
      run.setError(null);
      try {
        await api.chooseSimpleSite(projectId);
        loadArtifact();
        // Nothing to design or connect: this step is approved, so go on to the look.
        if (onApproved) onApproved();
        else onStageChange();
      } catch (e) {
        run.setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const described =
      choice === "files"
        ? describeUploads(uploads.filter((u) => u.kind !== "database"))
        : choice === "connect"
          ? describeUploads(uploads.filter((u) => u.kind === "database"))
          : "";
    run.send(
      described
        ? `Please design the database from my approved plan and ${choice === "connect" ? "my existing database" : "my uploaded data"}: ${described}.`
        : "Please design the database from my approved plan. I don't have existing data to upload.",
    );
  }

  // Errors surface in the confirm dialog, which stays open.
  async function startOver() {
    setBusy(true);
    run.setError(null);
    try {
      await api.resetStage(projectId, STAGE);
      setUnannounced([]);
      await run.reload();
      loadArtifact();
      onStageChange(); // an approved step was reopened
    } finally {
      setBusy(false);
    }
  }

  async function announce() {
    const names = unannounced.join(", ");
    if (await run.send(`I added ${names}. Please update the design to use this data.`)) setUnannounced([]);
  }

  async function act(action: "approve" | "reopen") {
    setBusy(true);
    run.setError(null);
    try {
      await (action === "approve" ? api.approve(projectId, STAGE) : api.reopen(projectId, STAGE));
      // The last step of this stage: pick where the website's data will live, so stay here until
      // it's connected. A simple site without a database has nothing to connect: go on.
      const needsConnecting = !connection && artifact?.data?.mode !== "none";
      if (action === "approve" && !needsConnecting && onApproved) onApproved();
      else onStageChange();
      if (action === "approve" && needsConnecting) setConnectFocus((n) => n + 1);
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const attach = !approved && (
    <>
      <button
        type="button"
        onClick={() => attachRef.current?.click()}
        disabled={uploading || run.running}
        aria-label="Add a data file"
        title="Add an Excel, CSV or SQL file"
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent disabled:opacity-40"
      >
        {uploading ? <CircleNotch size={18} className="animate-spin" /> : <FileArrowUp size={18} />}
      </button>
      <input
        ref={attachRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.xlsm,.csv,.sql"
        className="hidden"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );

  const notice =
    started && (unannounced.length > 0 || uploadError) ? (
      <div className="mb-2 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
        <FileArrowUp size={18} weight="duotone" className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-accent-ink">
          {uploadError ?? `Added ${unannounced.join(", ")}`}
        </span>
        {!uploadError && (
          <button
            onClick={announce}
            disabled={run.running}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40"
          >
            Ask Gagesite to use it
          </button>
        )}
        <button
          onClick={() => {
            setUnannounced([]);
            setUploadError(null);
          }}
          aria-label="Dismiss"
          className="text-accent-ink/60 hover:text-accent-ink"
        >
          <X size={14} />
        </button>
      </div>
    ) : null;

  return (
    <>
      {confirmReset && (
        <ConfirmDialog
          title="Start the database design over?"
          description={`You choose a starting point again and Gagesite designs the database from there.${approved ? " The step is approved, so it is reopened first and later steps wait for it again." : ""} This can't be undone.`}
          rows={[
            ["Cleared", "The database design and this conversation"],
            ["Kept", "Your plan, uploaded files and any connected database"],
          ]}
          confirmLabel="Start over"
          busyLabel="Clearing..."
          danger
          onConfirm={startOver}
          onClose={() => setConfirmReset(false)}
        />
      )}
      <StageLayout
        wide
        chatBusy={run.running}
        panelLabel="Design"
        panelIcon={TreeStructure}
        chat={
          <ChatColumn
            projectId={projectId}
            title="Database design"
            subtitle="Decide what information your website keeps and how it connects."
            messages={run.messages}
            live={run.live}
            error={run.error}
            approved={approved}
            placeholder="Ask for changes, e.g. 'Customers should be able to book for several people'..."
            onSend={run.send}
            onStop={run.stop}
            stopping={run.stopping}
            composerAccessory={attach}
            headerAction={
              started || approved ? (
                <StartOverTrigger onClick={() => setConfirmReset(true)} disabled={busy} />
              ) : null
            }
            notice={notice}
            emptyState={
              skipped ? (
                <ChatGreeting title="You skipped this step: no database.">
                  <p>
                    Your website keeps its content in its own files, and forms arrive by email. The right side shows
                    what that means.
                  </p>
                  <p>To add a database after all, reopen this step and choose Start over.</p>
                </ChatGreeting>
              ) : (
                <ChatGreeting title="Let's decide what information your website keeps.">
                  <p>Pick how to start on the right. Most people start from their plan; nothing to upload.</p>
                  <p>
                    Or just tell me in your own words, for example &ldquo;My bookings are in an Excel file&rdquo; or
                    &ldquo;I don&apos;t need a database&rdquo;.
                  </p>
                </ChatGreeting>
              )
            }
          />
        }
        startOnPanel={!started && !approved}
        panel={
          !started && !approved ? (
            <StartPanel title="Data model">
              <DataStart
                uploads={uploads}
                uploading={uploading}
                uploadError={uploadError}
                onUpload={upload}
                onRemove={remove}
                onStart={start}
                advice={advice}
                starting={busy}
                projectId={projectId}
                source={source}
                onSourceChange={(next, profile) => {
                  setSource(next);
                  setUploads(profile);
                  loadArtifact();
                }}
              />
            </StartPanel>
          ) : (
            <DataModelPanel
              projectId={projectId}
              connection={connection}
              connectFocus={connectFocus}
              onConnectionChange={setConnection}
              artifact={artifact}
              approved={approved}
              approvedAt={stage.approved_at}
              running={run.running}
              busy={busy}
              onApprove={() => act("approve")}
              onReopen={() => act("reopen")}
              onAsk={run.send}
            />
          )
        }
      />
    </>
  );
}
