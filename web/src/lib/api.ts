/** Opened on a public address (not this computer or the SSH tunnel): Caddy serves the API on the
 * same address, and website previews through PREVIEW_PORT (deploy/Caddyfile). */
const PUBLIC =
  typeof window !== "undefined" && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

export const API_URL = PUBLIC ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001");

/** A website preview's address in the browser: http://localhost:<port> as it is, or through the
 * preview port when Gagesite is opened on a public address. */
export function previewAddress(url: string, path = "/"): string {
  const page = path.startsWith("/") ? path : `/${path}`;
  const local = /^http:\/\/localhost:(\d+)\/?$/.exec(url);
  if (!PUBLIC || !local) return `${url}${page}`;
  const port = process.env.NEXT_PUBLIC_PREVIEW_PORT || "9022";
  return `${window.location.protocol}//${window.location.hostname}:${port}/__preview/${local[1]}${page}`;
}

export type StageStatus = "locked" | "active" | "approved";

export interface Project {
  id: string;
  name: string;
  created_at: string;
  /** The website's address while it is online; only in the project list. */
  live_url?: string | null;
}

export interface StageInfo {
  key: string;
  order: number;
  title: string;
  description: string;
  implemented: boolean;
  status: StageStatus;
  approved_at: string | null;
}

export interface ProjectDetail {
  project: Project;
  stages: StageInfo[];
  active_run: { id: string; stage_key: string } | null;
  kind?: ProjectKind;
  /** A landing page whose short brief isn't filled in yet. */
  brief_needed?: boolean;
  /** Stages a landing page's brief stood in for. */
  handled_by_brief?: string[];
}

export interface Message {
  id: number;
  role: "user" | "assistant" | "error";
  content: string;
  created_at: string;
  /** Files the owner attached: a JSON list of ChatFile (null when none). */
  attachments?: string | null;
  /** An AI reply's work in order (JSON of ReplyStep[]); older replies have none. */
  steps?: string | null;
}

/** One piece of an AI reply: something it wrote, a tool it used, or (team builds) who wrote it. */
export type ReplyStep =
  | { t: "text"; text: string }
  | { t: "tool"; name: string; summary: string }
  | { t: "label"; text: string; task?: string; role?: string; lane?: string };

export function messageSteps(message: Message): ReplyStep[] {
  if (!message.steps) return [];
  try {
    const steps = JSON.parse(message.steps);
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

/** A file attached to a chat message (a screenshot, PDF, text or Office file). */
export interface ChatFile {
  /** Its stored name: what the message refers to and the address it is shown from. */
  file: string;
  /** The name the owner's file had. */
  name: string;
  kind: "image" | "pdf" | "text" | "word" | "slides" | string;
  size?: number;
}

export function messageFiles(message: Message): ChatFile[] {
  if (!message.attachments) return [];
  try {
    const files = JSON.parse(message.attachments);
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

export interface Scope {
  status: "draft" | "ready";
  business: {
    name: string;
    industry: string;
    description: string;
    location: string;
    target_customers: string[];
    goals: string[];
    languages: string[];
  };
  site_type: string;
  /** What kind of website (research-lab, portfolio, personal-tool...): decides what to show first. */
  site_category?: string;
  site_categories?: string[];
  roles: { name: string; description: string }[];
  /** `type`: landing, content, listing, detail, chat, dashboard, form, docs, account, admin or auth. */
  pages: {
    name: string;
    path: string;
    purpose: string;
    type?: string;
    roles: string[];
    sections: string[];
  }[];
  features: {
    id: string;
    name: string;
    description: string;
    priority: "must" | "should" | "could";
    roles: string[];
    pages: string[];
    done_when?: string[];
  }[];
  entities: { name: string; description: string; fields: string[] }[];
  integrations: string[];
  /** Keys and settings the website reads (names only; values live in Keys & settings). */
  keys?: {
    name: string;
    purpose: string;
    secret: boolean;
    required: boolean;
  }[];
  branding: { tone: string; colors: string[]; style_notes: string };
  assumptions: string[];
  open_questions: string[];
  // The business side (project brief). Optional: plans written before it existed have none.
  brief?: ScopeBrief;
  business_rules?: string[];
  content_checklist?: ContentItem[];
  compliance?: { item: string; why: string }[];
  /** The real details that go on the website, collected in the chat. */
  details?: ScopeDetails;
  // How people use the site: read by the database, design and build stages.
  permissions?: { action: string; roles: string[] }[];
  flows?: ScopeFlow[];
  lifecycles?: ScopeLifecycle[];
  notifications?: {
    name: string;
    to: string;
    when: string;
    channel: "email" | "screen" | "sms" | "kakao";
  }[];
  /** Claude's advice on whether the site needs a database at all. */
  data_storage?: {
    needs_database: boolean | null;
    why: string;
    /** Where the owner's information lives today. */
    existing?: "" | "database" | "spreadsheets" | "other";
  };
  /** Whether other programs may fetch (or send) the data: built as an API with access keys in Stage 4. */
  program_access?: {
    needed: boolean | null;
    why: string;
    users?: string[];
    reads?: string[];
    writes?: string[];
  };
  /** A website the owner linked: their own (rebuilt closely) or one they like (ideas only). */
  existing_site?: { url: string; owned: boolean | null; keep: string };
}

/** A document the owner uploaded in Stage 1 for Claude to read (menu, price list, brochure...). */
export interface SourceDoc {
  file: string;
  kind: "pdf" | "word" | "slides" | "image" | "text" | "other" | "link";
  size: number;
  /** Word/PowerPoint only: whether a readable text copy could be made. */
  text_ready: boolean | null;
  /** A website Gagesite read from a link: its address and page title. */
  url?: string;
  title?: string;
}

/** A spreadsheet sheet that feeds a table (or is not imported). */
export interface DataSourceInfo {
  file: string;
  sheet: string;
  rows: number | null;
  /** False once the uploaded file has been deleted (after the design step). */
  available: boolean;
  notes: string;
}

export interface DataOverview {
  database: { connected: boolean; provider: string | null; error?: string };
  tables: {
    name: string;
    label: string;
    description: string;
    db_rows: number | null;
    sources: DataSourceInfo[];
  }[];
  not_imported: DataSourceInfo[];
  issues: { severity: "info" | "warning"; message: string }[];
}

export type ImportSource = {
  kind: "file" | "upload" | "db";
  file: string;
  sheet: string;
};

export interface ImportSheet {
  name: string;
  rows: number;
  columns: string[];
}

export interface ImportFile {
  id: string;
  name: string;
  sheets: ImportSheet[];
}

export interface ImportJob {
  table: string;
  status: "running" | "done" | "failed";
  total: number;
  added: number;
  skipped: number;
  error: string | null;
  seconds: number;
}

export interface ImportSources {
  uploads: ImportFile[];
  existing: {
    label: string;
    tables: { name: string; rows: number; columns: string[] }[] | null;
  } | null;
  job: ImportJob | null;
}

export interface ImportColumn {
  name: string;
  label: string;
  hint: string;
  kind: string;
  required: boolean;
  /** Filled in by Gagesite when left empty: a new id, or the current time. */
  auto: "" | "id" | "now";
  has_default: boolean;
  primary: boolean;
  unique: boolean;
  choices: string[];
  references: {
    table: string;
    column: string;
    match_options?: string[];
  } | null;
  secret: boolean;
}

export interface ImportMapping {
  column: string;
  from: string | null;
  value: string | null;
  match: string | null;
}

export interface ImportPlan {
  table: { name: string; label: string };
  columns: ImportColumn[];
  source_columns: string[];
  samples: Record<string, (string | number | boolean | null)[]>;
  rows: number;
  mapping: ImportMapping[];
}

export interface ImportCheck {
  total: number;
  ready: number;
  invalid: number;
  duplicates_file: number;
  duplicates_db: number;
  problems: {
    column: string;
    label: string;
    reason: string;
    count: number;
    rows: number[];
  }[];
  sample: Record<string, string | number | boolean | null>[];
  columns: string[];
}

export interface DataPage {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  total: number;
}

export interface ScopeDetails {
  phone: string;
  email: string;
  address: string;
  hours: { days: string; time: string }[];
  links: { name: string; url: string }[];
  legal_name: string;
  representative: string;
  registration_number: string;
  domain: string;
  /** Business-specific details (shipping fee, stylists...), with a hint on what is needed. */
  other: { label: string; value: string; hint: string }[];
  /** Standard fields that don't apply to this business (e.g. no address for an online shop). */
  not_needed: string[];
}

export interface ScopeFlow {
  id: string;
  name: string;
  role: string;
  goal: string;
  features: string[];
  steps: { actor: string; page: string; action: string; result: string }[];
  problems: { when: string; then: string }[];
}

export interface ScopeLifecycle {
  thing: string;
  states: { name: string; meaning: string }[];
  changes: { from: string; to: string; trigger: string }[];
}

/**
 * Claude rewrites the plan file while it works, so a draft can be half-written or miss keys.
 * Fill every list and object with a default, so the plan view never breaks on a gap.
 */
export function normalizeScope(raw: Partial<Scope>): Scope {
  const list = <T>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : [];
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const business = (raw.business ?? {}) as Partial<Scope["business"]>;
  const branding = (raw.branding ?? {}) as Partial<Scope["branding"]>;
  return {
    ...raw,
    status: raw.status === "ready" ? "ready" : "draft",
    business: {
      name: text(business.name),
      industry: text(business.industry),
      description: text(business.description),
      location: text(business.location),
      target_customers: list(business.target_customers),
      goals: list(business.goals),
      languages: list(business.languages),
    },
    site_type: text(raw.site_type),
    site_category: text(raw.site_category),
    roles: list(raw.roles),
    pages: list(raw.pages),
    features: list<Scope["features"][number]>(raw.features).map((f) => ({
      ...f,
      roles: list(f.roles),
      pages: list(f.pages),
      done_when: list(f.done_when),
    })),
    entities: list<Scope["entities"][number]>(raw.entities).map((e) => ({
      ...e,
      fields: list(e.fields),
    })),
    integrations: list(raw.integrations),
    keys: list(raw.keys),
    branding: {
      tone: text(branding.tone),
      colors: list(branding.colors),
      style_notes: text(branding.style_notes),
    },
    assumptions: list(raw.assumptions),
    open_questions: list(raw.open_questions),
    brief: {
      main_action: raw.brief?.main_action,
      goals: list(raw.brief?.goals),
      customers: list<{ name: string; needs: string[] }>(
        raw.brief?.customers,
      ).map((c) => ({ ...c, needs: list(c.needs) })),
      value: raw.brief?.value && {
        proposition: text(raw.brief.value.proposition),
        revenue: list(raw.brief.value.revenue),
        saves: list(raw.brief.value.saves),
        competitors: list(raw.brief.value.competitors),
      },
      running: raw.brief?.running && {
        updates: list(raw.brief.running.updates),
        monthly_cost: text(raw.brief.running.monthly_cost),
        notes: text(raw.brief.running.notes),
      },
      economics: raw.brief?.economics && {
        costs: list(raw.brief.economics.costs),
        expected_return: text(raw.brief.economics.expected_return),
        payback: text(raw.brief.economics.payback),
        basis: text(raw.brief.economics.basis),
      },
      discovery: list(raw.brief?.discovery),
      launch: {
        owner_time: list(raw.brief?.launch?.owner_time),
        timeline: list(raw.brief?.launch?.timeline),
      },
    },
    business_rules: list(raw.business_rules),
    content_checklist: list<Partial<ContentItem>>(raw.content_checklist).map(
      (c) => {
        const name = `${text(c.item)} ${text(c.detail)}`;
        return {
          item: text(c.item),
          detail: text(c.detail),
          status:
            c.status === "provided" || c.status === "placeholder"
              ? c.status
              : "needed",
          // Older plans have no kind: spot logos and photos by name.
          kind:
            c.kind ??
            (/logo|photo|image|picture|사진|로고|이미지/i.test(name)
              ? "image"
              : "info"),
          files: list(c.files),
          sample_keywords: text(c.sample_keywords),
          samples: list(c.samples),
        };
      },
    ),
    compliance: list(raw.compliance),
    permissions: list<{ action: string; roles: string[] }>(raw.permissions).map(
      (p) => ({ ...p, roles: list(p.roles) }),
    ),
    flows: list<ScopeFlow>(raw.flows).map((f) => ({
      ...f,
      role: text(f.role),
      goal: text(f.goal),
      features: list(f.features),
      steps: list(f.steps),
      problems: list(f.problems),
    })),
    lifecycles: list<ScopeLifecycle>(raw.lifecycles).map((l) => ({
      ...l,
      states: list(l.states),
      changes: list(l.changes),
    })),
    notifications: list(raw.notifications),
    details: {
      phone: text(raw.details?.phone),
      email: text(raw.details?.email),
      address: text(raw.details?.address),
      hours: list(raw.details?.hours),
      links: list(raw.details?.links),
      legal_name: text(raw.details?.legal_name),
      representative: text(raw.details?.representative),
      registration_number: text(raw.details?.registration_number),
      domain: text(raw.details?.domain),
      other: list<{ label: string; value: string; hint: string }>(
        raw.details?.other,
      ).map((o) => ({
        label: text(o.label),
        value: text(o.value),
        hint: text(o.hint),
      })),
      not_needed: list(raw.details?.not_needed),
    },
  };
}

export interface ScopeBrief {
  main_action?: { label: string; why: string };
  goals?: { goal: string; measure: string }[];
  customers?: { name: string; needs: string[] }[];
  value?: {
    proposition: string;
    revenue: string[];
    saves: string[];
    competitors: string[];
  };
  running?: { updates: string[]; monthly_cost: string; notes: string };
  economics?: {
    costs: {
      item: string;
      amount: string;
      period: "once" | "month" | "year";
    }[];
    expected_return: string;
    payback: string;
    basis: string;
  };
  discovery?: { channel: string; action: string }[];
  launch?: {
    owner_time: { task: string; time: string }[];
    timeline: { step: string; when: string; who: string }[];
  };
}

export interface ContentItem {
  item: string;
  detail: string;
  status: "needed" | "provided" | "placeholder";
  kind: "image" | "text" | "info";
  /** The owner's uploads for an image item (in brand/). */
  files: string[];
  /** English search words for sample photos, e.g. "cafe,latte". */
  sample_keywords: string;
  /** Sample photos the owner chose to use for now (found by the backend, with credits). */
  samples: { url: string; thumb: string; credit: string }[];
}

export interface ScopeArtifact {
  exists: boolean;
  data: Scope | null;
  markdown: string | null;
  errors: string[];
  /** Claude considers the plan complete. */
  ready: boolean;
  /** The only things that block approval; everything else can be finished later. */
  required?: { key: string; label: string; done: boolean }[];
  approvable?: boolean;
}

export type ColumnType =
  | "String"
  | "Int"
  | "Float"
  | "Decimal"
  | "Boolean"
  | "DateTime"
  | "Json"
  | "Enum";

export interface DbColumn {
  name: string;
  type: ColumnType;
  enum?: string | null;
  required: boolean;
  unique: boolean;
  primary: boolean;
  references: { table: string; column: string } | null;
  description: string;
  example: string;
  source: string | null;
}

export interface DbTable {
  name: string;
  label: string;
  description: string;
  columns: DbColumn[];
}

export interface DatabaseSchema {
  status: "draft" | "ready";
  /** "none": a simple site without a database (content in files, forms by email). */
  mode?: "database" | "none";
  content_files?: { file: string; holds: string }[];
  email_forms?: { form: string; to: string; note: string }[];
  /** Without a database: what the plan loses. */
  left_out?: string[];
  tables: DbTable[];
  relations: {
    from_table: string;
    to_table: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    label: string;
  }[];
  enums: { name: string; values: string[] }[];
  data_sources: {
    file: string;
    sheet: string;
    maps_to: string | null;
    rows: number | null;
    notes: string;
  }[];
  data_issues: {
    severity: "info" | "warning";
    message: string;
    source: string;
  }[];
  assumptions: string[];
  open_questions: string[];
}

export interface ColumnProfile {
  name: string;
  inferred_type: string;
  filled_percent: number;
  unique_count: number;
  samples: string[];
  personal: boolean;
}

/** The owner's existing database, connected read-only as a source for the design. */
export interface SourceDb {
  provider: DbProvider;
  label: string;
  host: string;
  database: string;
  table_count: number;
  connected_at: string;
}

export interface FileProfile {
  file: string;
  /** "database": the owner's existing database (connected, read-only). */
  kind: "spreadsheet" | "sql" | "database";
  sheets: {
    name: string;
    rows: number;
    columns: ColumnProfile[];
    notes: string[];
  }[];
  sql_excerpt: string | null;
  error: string | null;
}

export interface DatabaseArtifact {
  exists: boolean;
  data: DatabaseSchema | null;
  markdown: string | null;
  prisma: string | null;
  profile: FileProfile[];
  errors: string[];
  ready: boolean;
  /** Complete and valid: the owner may approve it without waiting for "ready". */
  approvable?: boolean;
}

export type DbProvider = "supabase" | "neon" | "postgres";

/** The owner's database, minus the connection string (the API never returns it). */
export interface DbConnection {
  provider: DbProvider;
  host: string;
  database: string;
  username: string;
  server_version: string;
  table_count: number;
  tested_at: string;
}

export interface ConnectionTest {
  ok: boolean;
  error: string | null;
  hint: string | null;
  host: string | null;
  database: string | null;
  username: string | null;
  server_version: string | null;
  can_create: boolean | null;
  table_count: number | null;
}

export type PhotoTag = "hero" | "menu" | "about" | "gallery" | "other";

export interface DesignKit {
  logo: string | null;
  colors: string[];
  photos: { file: string; tag: PhotoTag }[];
  references: string[];
  style_notes: string;
  avoid: string;
  mockup_format: "html" | "nextjs";
  /** The owner's 3D model (brand/model.glb), if uploaded. */
  model?: string | null;
  /** Show the model as a 3D showcase on the home page. */
  showcase_3d?: boolean;
  /** Who draws the style options: Gagesite's own designer, or Google Stitch as well. */
  design_engine?: DesignEngine;
}

export type DesignEngine = "gagesite" | "stitch";

/** Google Stitch, connected once for this Gagesite (the key itself is never sent back). */
export interface StitchStatus {
  connected: boolean;
  hint: string | null;
  tools: string[];
  connected_at: string | null;
}

export type DesignFileKind = "logo" | "photo" | "reference" | "model";

export interface DesignPalette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  primary_text: string;
  accent: string;
  border: string;
}

export interface DesignArtifact {
  exists: boolean;
  status: "choosing" | "designing" | "ready" | null;
  /** A design plan exists (it comes before the styles), so the design has started. */
  has_plan?: boolean;
  chosen_direction: number | null;
  open_questions: string[];
  directions: {
    id: number;
    name: string;
    summary: string;
    /** The style Gagesite would pick, when it offers several. */
    recommended?: boolean;
    /** Who drew it: "stitch" when Google Stitch did. */
    made_with?: DesignEngine;
    /** Google Stitch's own screen for this style, as Stitch drew it (file names). */
    stitch_original?: { image?: string; html?: string } | null;
    /** The real products whose layout and flow this style follows (from Gagesite's research). */
    inspired_by?: string[];
    /** One sentence: which patterns come from them. */
    borrowed?: string;
    palette: DesignPalette;
    fonts: { display: string; body: string };
    radius: string;
    file: string;
    exists: boolean;
  }[];
  tokens: {
    palette: DesignPalette;
    fonts: { display: string; body: string };
    radius: string;
    style_notes?: string;
  } | null;
  components: DesignComponent[];
  /** "components.html" once the library exists. */
  components_file: string | null;
  /** The key pages drawn in this step. */
  pages: {
    slug: string;
    name: string;
    path: string;
    file: string;
    exists: boolean;
  }[];
  /** Pages built straight in Stage 4 from the component library. */
  later_pages?: { name: string; path: string }[];
  /** Bumps only when a preview file changes. */
  version?: number;
  markdown: string | null;
  errors: string[];
  ready: boolean;
  /** The owner skipped UI Design to build a landing page (Stage 4 designs it). */
  skipped?: boolean;
}

export interface DesignComponent {
  id: string;
  name: string;
  group:
    | "Foundations"
    | "Buttons"
    | "Forms"
    | "Navigation"
    | "Cards"
    | "Sections"
    | "Feedback"
    | string;
  description: string;
  used_on: string[];
}

/** Events streamed from a `claude -p` run (see backend/app/runner.py). */
export type RunEvent =
  | { type: "queued" | "started" | "message_start" }
  | { type: "init"; session_id: string; model: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; summary: string }
  | {
      type: "result";
      is_error: boolean;
      cost_usd: number | null;
      duration_ms: number;
      num_turns: number;
    }
  | { type: "artifact"; ready: boolean; errors: string[] }
  | { type: "done"; status: "succeeded" | "failed" };

/** A key or setting the website reads. The value never comes back: only whether it is set and a hint. */
export interface ProjectKey {
  name: string;
  purpose: string;
  secret: boolean;
  required: boolean;
  /** owner: defined by the owner (any name); online: the finished code needs it to go live (Stage 5). */
  source: "owner" | "online";
  set: boolean;
  /** Last 4 characters of a secret (the whole value of a non-secret setting). */
  hint: string;
}

export interface ProjectKeys {
  keys: ProjectKey[];
  /** Keys the plan proposed that the owner hasn't added: one click to add, or ignore. */
  suggestions: { name: string; purpose: string; secret: boolean }[];
}

/** The Claude accounts Gagesite can run on. Tokens never leave the server; only the last 4 characters. */
export interface ClaudeAccount {
  id: string;
  name: string;
  hint: string;
  active: boolean;
  created_at: string | null;
  last_used_at: string | null;
}
export interface ClaudeAccounts {
  /** null: runs use this computer's own Claude Code login. */
  active_id: string | null;
  computer: { logged_in: boolean; email: string | null; plan: string | null };
  accounts: ClaudeAccount[];
}

/** Stage 1's workflow flowchart (docs/01-flowchart.json), made by Gagesite once the requirements are in. */
export interface FlowchartNode {
  id: string;
  type: "start" | "step" | "decision" | "end";
  label: string;
  actor?: string;
  page?: string;
  flow?: string;
}
export interface Flowchart {
  version?: number;
  summary?: string;
  nodes: FlowchartNode[];
  edges: { from: string; to: string; label?: string }[];
  gaps?: { question: string; why?: string }[];
}
export interface FlowchartInfo {
  chart: Flowchart | null;
  error: string | null;
  generated_at: number | null;
  /** The plan changed after the flowchart was made. */
  stale: boolean;
  running: boolean;
  failed: boolean;
  can_generate: boolean;
  /** Why it can't be generated yet (plain words). */
  reason: string;
}

/** The server's reason in plain words: a message, or the first of a list of input problems
 *  (FastAPI's validation answer is a list of objects, never shown as "[object Object]"). */
function errorText(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    const field = Array.isArray(first?.loc)
      ? first.loc.filter((p) => p !== "body").join(" ")
      : "";
    if (first?.msg) return field ? `${field}: ${first.msg}` : first.msg;
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // One content-type header whatever the caller passes (two differently written ones would be
  // merged into "application/json, application/json", which the server can't read as JSON).
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      errorText(body.detail) ?? `Request failed (${response.status})`,
    );
  }
  return response.json();
}

export interface PreviewInfo {
  /** "offline" is set by the app itself when Gagesite's server doesn't answer. */
  status:
    | "installing"
    | "building"
    | "starting"
    | "running"
    | "stopped"
    | "failed"
    | "offline";
  /** "dev" while Gagesite builds (changes show at once); "production" once finished: the real build. */
  mode?: "dev" | "production";
  /** Where the running website answers, e.g. http://localhost:3100. */
  url: string | null;
  /** "UI + dedicated API": where the website's own API answers locally; its docs are at /docs. */
  api_url?: string | null;
  log: string[];
}

export interface BuildPage {
  path: string;
  name: string;
  status: "todo" | "done";
  /** The real address to open in the preview (dynamic routes get an example id). */
  preview: string;
  /** docs/04-screens/<slug>.jpg once the platform has photographed the page. */
  screenshot: string | null;
  screenshot_at: number | null;
}

/** Stage 4 as an agent team: the task board and where the team is. */
export type TeamTaskStatus =
  | "todo"
  | "building"
  | "built"
  | "testing"
  | "passed"
  | "bug_found"
  | "fixing"
  | "blocked";
export interface TeamBug {
  id: string;
  title: string;
  severity: "blocker" | "major" | "minor" | null;
  page: string | null;
  steps: string[] | null;
  expected: string | null;
  actual: string | null;
  status: "open" | "fixed" | "cannot_reproduce" | "verified";
}
export interface TeamTask {
  id: string;
  title: string;
  kind: string;
  pages: string[];
  status: TeamTaskStatus;
  attempts: number;
  acceptance: string[];
  bugs: TeamBug[];
  /** "UI + dedicated API": which developer's lane the task is in. */
  lane?: "api" | "ui" | null;
}
export type TeamRole = "advisor" | "dev" | "api_dev" | "qa";
export interface TeamInfo {
  state: "running" | "paused" | "blocked" | "done" | "failed";
  message: string;
  current: { role?: TeamRole; task?: string; title?: string; run_id?: string };
  /** Two-lane builds: everyone at work right now, one per lane. */
  lanes?: {
    lane: "api" | "ui";
    role: TeamRole;
    task?: string;
    title?: string;
    run_id?: string;
  }[];
  tasks: TeamTask[];
  inbox: number;
  max_attempts: number;
}

/** How the website is built (Stage 4). */
export interface BuildSetup {
  setup: "all_in_one" | "api_service" | "static_external" | "landing";
  api_language: "typescript" | "python";
  /** Landing page: its showpiece (motion, a three.js scene, or a video made in Google Flow). */
  landing_style: LandingStyle;
  /** UI Design was skipped: only a landing page can be built. */
  design_skipped?: boolean;
  /** The owner chose the setup when creating the project. */
  chosen_at_start?: boolean;
  /** Gagesite's recommendation for this plan, and why. */
  recommended?: BuildSetup["setup"];
  recommended_why?: string;
  /** The landing page's hero video, once uploaded or made. */
  landing_video?: { file: string; size: number } | null;
  /** The phone (9:16) version, when there is one. */
  landing_video_portrait?: { file: string; size: number } | null;
  /** Google Flow prompts the builder wrote for the hero video. */
  video_prompts?: VideoPrompt[];
  /** Static UI + another service's API: which API the pages call. */
  api_base_url: string;
  api_docs_url: string;
  api_auth: "none" | "public_key";
  api_notes: string;
  available: BuildSetup["setup"][];
  /** Static UI + another service's API, but its address is still missing. */
  needs_service: boolean;
  /** The setup has its own API, so it needs a database. */
  needs_database: boolean;
  database_ready: boolean;
  /** The owner's secret keys: they need a server, so a static UI can't use them. */
  server_keys?: string[];
  /** The build has started: changing the setup needs Start over. */
  locked: boolean;
}

/** What the owner chooses; the rest of BuildSetup is worked out by the backend. */
export type BuildSetupChoice = Pick<
  BuildSetup,
  | "setup"
  | "api_language"
  | "api_base_url"
  | "api_docs_url"
  | "api_auth"
  | "api_notes"
  | "landing_style"
>;

export type LandingStyle = "modern" | "3d" | "video";

/** What a project is: a full website (five stages) or one landing page (a brief, then the build). */
export type ProjectKind = "website" | "landing";
/** A website's build setup chosen at the start ("unsure": recommended after the plan). */
export type StartSetup =
  "unsure" | "all_in_one" | "api_service" | "static_external";

/** A landing page's short brief, in place of Plan, Database and UI Design. */
export interface LandingBriefInput {
  business_name: string;
  offer: string;
  industry?: string;
  main_action?: string;
  main_action_link?: string;
  facts?: string;
  contact?: string;
  location?: string;
  languages?: string[];
  link?: string;
  showpiece: LandingStyle;
  colors?: string[];
  style_note?: string;
  prompt?: string;
}

/** One section of a landing page's scroll storyboard. */
export interface StoryboardSection {
  id?: string;
  name: string;
  /** Where it sits in the page's scroll, 0-100. */
  scroll?: [number, number];
  content?: string;
  visual?: string;
  motion?: string;
  interaction?: string;
  phone?: string;
  reduced_motion?: string;
  uses?: string[];
}

/** The Motion Director's storyboard (docs/04-storyboard.json). */
export interface Storyboard {
  status: "draft" | "approved";
  concept: string;
  big_idea: string;
  mood?: { palette?: string[]; type?: string; light?: string; pace?: string };
  showpiece?: string;
  sections: StoryboardSection[];
  system?: Record<
    "motion" | "layout" | "components" | "interaction" | "responsive",
    unknown
  >;
  assets_needed?: string[];
  notes_for_owner?: string;
}

/** One of the looks the Motion Director offers before the storyboard (docs/04-directions.json). */
export interface Direction {
  id: string;
  name: string;
  line: string;
  big_idea: string;
  type?: { display?: string; body?: string };
  palette?: string[];
  layout?: string;
  hero?: string;
  signature_motion?: string;
  feels_like?: string;
  differs_from_others?: string;
}

export interface Directions {
  status: "choose" | "chosen";
  directions: Direction[];
  chosen?: string;
  owner_note?: string;
}

export interface StoryboardInfo {
  storyboard: Storyboard | null;
  directions: Directions | null;
  markdown: string | null;
  approved: boolean;
  build_started: boolean;
}

export interface VideoPrompt {
  title: string;
  prompt: string;
  aspect: "16:9" | "9:16";
  /** 6 to 10 seconds: a short loop. */
  seconds: number;
}

/** Gagesite's own Google Flow sign-in (used to make landing page videos in the background). */
export interface FlowStatus {
  chrome_found: boolean;
  signing_in: boolean;
  signed_in: boolean;
  checked_at: string | null;
  busy: boolean;
}

export interface FlowJob {
  id: string;
  project_id: string;
  prompt: string;
  aspect: "16:9" | "9:16";
  status: "queued" | "running" | "done" | "failed";
  step: string;
  error: string;
  created_at: string;
  finished_at: string;
}

export interface BuildArtifact {
  exists: boolean;
  status: "building" | "ready" | null;
  pages: BuildPage[];
  test_accounts: { role: string; email: string; password: string }[];
  open_questions: string[];
  markdown: string | null;
  site_exists: boolean;
  installed: boolean;
  preview: PreviewInfo;
  /** The last self-test: every finished page opened logged out and as each test account. */
  check: BuildCheck | null;
  errors: string[];
  ready: boolean;
}

export interface BuildCheck {
  ok: boolean;
  checked_at: number | null;
  /** True when it was the final test: everything done, run on the production build. */
  final?: boolean;
  /** How many API addresses were called. */
  api?: number;
  problems: { page: string; as: string; problem: string }[];
}

export interface GitHubInfo {
  repo: string;
  url: string;
  connected_at: string;
  last_push_at: string | null;
  last_commit: string | null;
  last_error: string | null;
}

export interface VercelInfo {
  username: string;
  connected_at: string;
}

export interface DeployStep {
  key: "code" | "database" | "upload" | "build" | "check";
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  detail: string;
}

/** "UI + dedicated API": the API in Docker on a server the owner controls (Stage 5). */
export interface ApiServerInfo {
  /** The website has an API of its own. */
  available: boolean;
  targets: string[];
  /** The Stage 2 database the API uses (never its address). */
  database: { provider: string; host: string; database: string } | null;
  target: "this_pc" | "ssh";
  /** Your own server: where Gagesite signs in with its own key (the public half is shown to add there). */
  server: {
    host: string | null;
    ssh_port: number | null;
    user: string | null;
    public_key: string | null;
    connected: boolean;
  } | null;
  /** The website is online on Vercel: a new API address is given to it too. */
  website_live: boolean;
  port: number;
  auto_update: boolean;
  status: "idle" | "running" | "live" | "failed" | "stopped";
  url: string | null;
  docs_url: string | null;
  steps: {
    key: string;
    label: string;
    status: DeployStep["status"];
    detail: string;
  }[];
  error: string | null;
  log: string | null;
  /** Why the last attempt started: the owner pressed the button, or a change was put online by itself. */
  reason: "owner" | "change" | null;
  live_at: string | null;
  finished_at: string | null;
  /** Gagesite changed the API since this version went online. */
  out_of_date: boolean;
  /** The first login the API's production script made (password shown on request, like the website's). */
  first_account_email: string | null;
  /** The API has the script that makes the first login (Stage 5 "Get it ready" writes it). */
  account_script: boolean;
  /** The last read-only test of the live address after it went online. */
  smoke: {
    passed: number;
    total: number;
    signed_in: boolean;
    at: string;
    checks: { name: string; ok: boolean; status: number; detail: string }[];
  } | null;
}

export interface DeploySetting {
  name: string;
  label: string;
  purpose: string;
  help: string;
  required: boolean;
  filled: boolean;
  /** Saved, but its service refused it (Gagesite tested it), in plain words. */
  problem?: string | null;
}

export interface DeployArtifact {
  /** docs/05-deploy.json exists: Gagesite has looked at the website for going online. */
  exists: boolean;
  status: "preparing" | "ready" | null;
  settings: DeploySetting[];
  /** The website has logins: the owner chooses their own first account. */
  first_account: boolean;
  /** The live site's first login: Gagesite makes it (and keeps it to show) instead of asking. */
  first_login?: { email: string; created: boolean; kept: boolean };
  has_database: boolean;
  markdown: string | null;
  deployment: {
    status: "idle" | "running" | "live" | "failed";
    steps: DeployStep[];
    url: string | null;
    error: string | null;
    has_log: boolean;
    started_at: string | null;
    live_at: string | null;
    first_account_email: string | null;
    vercel_project: string | null;
    /** Set while the owner has taken the website offline (paused on Vercel). */
    offline_at: string | null;
    /** Something changed since the website last went online (code, settings or the API's address). */
    changes_waiting: boolean;
  };
  errors: string[];
  ready: boolean;
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (
    name: string,
    kind: ProjectKind = "website",
    setup: StartSetup = "unsure",
  ) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, kind, setup }),
    }),
  switchToLanding: (id: string) =>
    request<{ ok: boolean; next: string }>(`/api/projects/${id}/to-landing`, {
      method: "POST",
    }),
  getLandingBrief: (id: string) =>
    request<{
      brief: (LandingBriefInput & { languages: string[] }) | null;
      suggested: {
        business_name: string;
        offer: string;
        location: string;
      } | null;
      locked: boolean;
    }>(`/api/projects/${id}/landing-brief`),
  submitLandingBrief: (id: string, brief: LandingBriefInput) =>
    request<{ ok: boolean; next: string }>(
      `/api/projects/${id}/landing-brief`,
      {
        method: "POST",
        body: JSON.stringify(brief),
      },
    ),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  getMessages: (id: string, stage: string) =>
    request<Message[]>(`/api/projects/${id}/stages/${stage}/messages`),
  sendMessage: (
    id: string,
    stage: string,
    content: string,
    attachments: string[] = [],
  ) =>
    request<{ run_id: string | null; queued?: boolean }>(
      `/api/projects/${id}/stages/${stage}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, attachments }),
      },
    ),
  uploadChatFile: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file, file.name || "screenshot.png");
    const response = await fetch(`${API_URL}/api/projects/${id}/chat-files`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as ChatFile;
  },
  chatFileUrl: (id: string, file: string) =>
    `${API_URL}/api/projects/${id}/chat-files/${encodeURIComponent(file)}`,
  /** No database: writes the simple-site design from the plan and approves Stage 2 at once. */
  chooseSimpleSite: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/stages/02-database/simple`, {
      method: "POST",
    }),
  /** Start a stage over: clears its outputs and conversation (uploaded files are kept). */
  resetStage: (id: string, stage: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/stages/${stage}/reset`, {
      method: "POST",
    }),
  getScope: (id: string) =>
    request<ScopeArtifact>(`/api/projects/${id}/stages/01-scope/artifact`).then(
      (a) => ({
        ...a,
        data: a.data ? normalizeScope(a.data) : null,
      }),
    ),
  uploadContentFiles: async (
    id: string,
    index: number,
    item: string,
    files: File[],
  ) => {
    const body = new FormData();
    body.append("item", item);
    files.forEach((file) => body.append("files", file));
    const response = await fetch(
      `${API_URL}/api/projects/${id}/stages/01-scope/content/${index}/files`,
      {
        method: "POST",
        body,
      },
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    const a = (await response.json()) as ScopeArtifact;
    return { ...a, data: a.data ? normalizeScope(a.data) : null };
  },
  chooseContent: (
    id: string,
    index: number,
    item: string,
    status: "needed" | "placeholder",
  ) =>
    request<ScopeArtifact>(
      `/api/projects/${id}/stages/01-scope/content/${index}`,
      {
        method: "PUT",
        body: JSON.stringify({ item, status }),
      },
    ).then((a) => ({ ...a, data: a.data ? normalizeScope(a.data) : null })),
  saveScopeDetails: (id: string, details: ScopeDetails) =>
    request<ScopeArtifact>(`/api/projects/${id}/stages/01-scope/details`, {
      method: "PUT",
      body: JSON.stringify(details),
    }).then((a) => ({ ...a, data: a.data ? normalizeScope(a.data) : null })),
  getDatabase: (id: string) =>
    request<DatabaseArtifact>(
      `/api/projects/${id}/stages/02-database/artifact`,
    ),
  listUploads: (id: string) =>
    request<FileProfile[]>(`/api/projects/${id}/uploads`),
  uploadFile: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_URL}/api/projects/${id}/uploads`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as FileProfile[];
  },
  deleteUpload: (id: string, filename: string) =>
    request<FileProfile[]>(
      `/api/projects/${id}/uploads/${encodeURIComponent(filename)}`,
      { method: "DELETE" },
    ),
  approve: (id: string, stage: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/stages/${stage}/approve`, {
      method: "POST",
    }),
  reopen: (id: string, stage: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/stages/${stage}/reopen`, {
      method: "POST",
    }),
  getConnection: (id: string) =>
    request<DbConnection | null>(`/api/projects/${id}/database-connection`),
  /** An existing database to design around in Stage 2 (read only; never where the site's data lives). */
  getSourceDatabase: (id: string) =>
    request<SourceDb | null>(`/api/projects/${id}/source-database`),
  connectSourceDatabase: (id: string, provider: DbProvider, url: string) =>
    request<{ source: SourceDb; uploads: FileProfile[] }>(
      `/api/projects/${id}/source-database`,
      {
        method: "PUT",
        body: JSON.stringify({ provider, url }),
      },
    ),
  disconnectSourceDatabase: (id: string) =>
    request<{ source: null; uploads: FileProfile[] }>(
      `/api/projects/${id}/source-database`,
      { method: "DELETE" },
    ),
  testConnection: (id: string, provider: DbProvider, url: string) =>
    request<ConnectionTest>(`/api/projects/${id}/database-connection/test`, {
      method: "POST",
      body: JSON.stringify({ provider, url }),
    }),
  retestConnection: (id: string) =>
    request<ConnectionTest>(`/api/projects/${id}/database-connection/retest`, {
      method: "POST",
    }),
  saveConnection: (id: string, provider: DbProvider, url: string) =>
    request<DbConnection>(`/api/projects/${id}/database-connection`, {
      method: "PUT",
      body: JSON.stringify({ provider, url }),
    }),
  getDataOverview: (id: string) =>
    request<DataOverview>(`/api/projects/${id}/data`),
  getDataRows: (
    id: string,
    q: {
      table: string;
      source: "db" | "file";
      file?: string;
      sheet?: string;
      offset: number;
      limit: number;
    },
  ) => {
    const params = new URLSearchParams({
      table: q.table,
      source: q.source,
      file: q.file ?? "",
      sheet: q.sheet ?? "",
      offset: String(q.offset),
      limit: String(q.limit),
    });
    return request<DataPage>(`/api/projects/${id}/data/rows?${params}`);
  },
  importSources: (id: string) =>
    request<ImportSources>(`/api/projects/${id}/data/import/sources`),
  importUpload: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(
      `${API_URL}/api/projects/${id}/data/import/file`,
      { method: "POST", body },
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as ImportFile;
  },
  importForget: (id: string, fileId: string) =>
    request<null>(
      `/api/projects/${id}/data/import/file/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
    ),
  importPlan: (id: string, table: string, source: ImportSource) =>
    request<ImportPlan>(`/api/projects/${id}/data/import/plan`, {
      method: "POST",
      body: JSON.stringify({ table, source }),
    }),
  importCheck: (
    id: string,
    table: string,
    source: ImportSource,
    mapping: ImportMapping[],
  ) =>
    request<ImportCheck>(`/api/projects/${id}/data/import/check`, {
      method: "POST",
      body: JSON.stringify({ table, source, mapping }),
    }),
  importRun: (
    id: string,
    table: string,
    source: ImportSource,
    mapping: ImportMapping[],
  ) =>
    request<ImportJob>(`/api/projects/${id}/data/import/run`, {
      method: "POST",
      body: JSON.stringify({ table, source, mapping }),
    }),
  importStatus: (id: string) =>
    request<ImportJob | null>(`/api/projects/${id}/data/import/status`),
  getConnectionTables: (id: string) =>
    request<{
      design: string[];
      existing: string[];
      other_tables: number;
      supabase_ref: string | null;
    }>(`/api/projects/${id}/database-connection/tables`),
  getSqlPreview: (id: string) =>
    request<{ sql: string }>(
      `/api/projects/${id}/database-connection/sql-preview`,
    ),
  createTables: (id: string) =>
    request<{ created: string[] }>(
      `/api/projects/${id}/database-connection/create-tables`,
      { method: "POST" },
    ),
  deleteConnection: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/database-connection`, {
      method: "DELETE",
    }),
  getDesign: (id: string) =>
    request<DesignArtifact>(`/api/projects/${id}/stages/03-design/artifact`),
  getDesignPlan: (id: string) =>
    request<DesignPlanInfo>(`/api/projects/${id}/design/plan`),
  approveDesignPlan: (id: string) =>
    request<{ plan: DesignPlan }>(`/api/projects/${id}/design/plan/approve`, {
      method: "POST",
    }),
  reopenDesignPlan: (id: string) =>
    request<{ plan: DesignPlan }>(`/api/projects/${id}/design/plan/reopen`, {
      method: "POST",
    }),
  stopRun: (runId: string) =>
    request<{ ok: boolean }>(`/api/runs/${runId}/stop`, { method: "POST" }),
  getBuild: (id: string) =>
    request<BuildArtifact>(`/api/projects/${id}/stages/04-build/artifact`),
  getBuildSetup: (id: string) =>
    request<BuildSetup>(`/api/projects/${id}/build/setup`),
  putBuildSetup: (id: string, choice: BuildSetupChoice) =>
    request<BuildSetup>(`/api/projects/${id}/build/setup`, {
      method: "PUT",
      body: JSON.stringify(choice),
    }),
  uploadLandingVideo: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(
      `${API_URL}/api/projects/${id}/build/landing-video`,
      { method: "POST", body },
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(
        errorText(detail.detail) || `Upload failed (${response.status})`,
      );
    }
    return (await response.json()) as BuildSetup;
  },
  getStoryboard: (id: string) =>
    request<StoryboardInfo>(`/api/projects/${id}/build/storyboard`),
  chooseDirection: (id: string, direction: string, note: string) =>
    request<StoryboardInfo>(`/api/projects/${id}/build/directions/choose`, {
      method: "POST",
      body: JSON.stringify({ id: direction, note }),
    }),
  approveStoryboard: (id: string) =>
    request<StoryboardInfo>(`/api/projects/${id}/build/storyboard/approve`, {
      method: "POST",
    }),
  getFlow: () => request<FlowStatus>(`/api/flow`),
  flowSignIn: () =>
    request<FlowStatus>(`/api/flow/sign-in`, { method: "POST" }),
  flowCheck: () => request<FlowStatus>(`/api/flow/check`, { method: "POST" }),
  generateLandingVideo: (id: string, p: VideoPrompt) =>
    request<FlowJob>(`/api/projects/${id}/build/landing-video/generate`, {
      method: "POST",
      body: JSON.stringify({
        prompt: p.prompt,
        aspect: p.aspect,
        seconds: p.seconds,
      }),
    }),
  landingVideoJobs: (id: string) =>
    request<FlowJob[]>(`/api/projects/${id}/build/landing-video/jobs`),
  deleteLandingVideo: (id: string) =>
    request<BuildSetup>(`/api/projects/${id}/build/landing-video`, {
      method: "DELETE",
    }),
  /** Skip UI Design and build a landing page instead (Stage 4 designs it). */
  skipDesign: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/design/skip`, {
      method: "POST",
    }),
  getTeam: (id: string) =>
    request<TeamInfo | null>(`/api/projects/${id}/build/team`),
  startTeam: (id: string, retryBlocked = false) =>
    request<TeamInfo>(`/api/projects/${id}/build/team/start`, {
      method: "POST",
      body: JSON.stringify({ retry_blocked: retryBlocked }),
    }),
  pauseTeam: (id: string) =>
    request<TeamInfo | null>(`/api/projects/${id}/build/team/pause`, {
      method: "POST",
    }),
  getPreview: (id: string) =>
    request<PreviewInfo>(`/api/projects/${id}/build/preview`),
  startPreview: (id: string) =>
    request<PreviewInfo>(`/api/projects/${id}/build/preview/start`, {
      method: "POST",
    }),
  stopPreview: (id: string) =>
    request<PreviewInfo>(`/api/projects/${id}/build/preview/stop`, {
      method: "POST",
    }),
  runCheck: (id: string) =>
    request<{ check: BuildCheck | null }>(`/api/projects/${id}/build/screens`, {
      method: "POST",
    }),
  getGitHub: (id: string) =>
    request<GitHubInfo | null>(`/api/projects/${id}/github`),
  connectGitHub: (id: string, repo: string, token: string) =>
    request<GitHubInfo>(`/api/projects/${id}/github`, {
      method: "PUT",
      body: JSON.stringify({ repo, token }),
    }),
  disconnectGitHub: (id: string) =>
    request<null>(`/api/projects/${id}/github`, { method: "DELETE" }),
  pushGitHub: (id: string) =>
    request<GitHubInfo>(`/api/projects/${id}/github/push`, { method: "POST" }),
  getApiServer: (id: string) =>
    request<ApiServerInfo>(`/api/projects/${id}/api-server`),
  saveApiServer: (
    id: string,
    body: {
      target?: string;
      port?: number;
      auto_update?: boolean;
      ssh_host?: string;
      ssh_port?: number;
      ssh_user?: string;
    },
  ) =>
    request<ApiServerInfo>(`/api/projects/${id}/api-server`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  apiServerKey: (id: string) =>
    request<{ public_key: string }>(`/api/projects/${id}/api-server/ssh-key`, {
      method: "POST",
    }),
  deployApiServer: (id: string) =>
    request<ApiServerInfo>(`/api/projects/${id}/api-server/deploy`, {
      method: "POST",
    }),
  stopApiServer: (id: string) =>
    request<ApiServerInfo>(`/api/projects/${id}/api-server/stop`, {
      method: "POST",
    }),
  getDeploy: (id: string) =>
    request<DeployArtifact>(`/api/projects/${id}/stages/05-deploy/artifact`),
  getVercel: (id: string) =>
    request<VercelInfo | null>(`/api/projects/${id}/vercel`),
  connectVercel: (id: string, token: string) =>
    request<VercelInfo>(`/api/projects/${id}/vercel`, {
      method: "PUT",
      body: JSON.stringify({ token }),
    }),
  disconnectVercel: (id: string) =>
    request<null>(`/api/projects/${id}/vercel`, { method: "DELETE" }),
  takeOffline: (id: string) =>
    request<DeployArtifact>(`/api/projects/${id}/deploy/offline`, {
      method: "POST",
    }),
  backOnline: (id: string) =>
    request<DeployArtifact>(`/api/projects/${id}/deploy/back-online`, {
      method: "POST",
    }),
  saveDeploySettings: (id: string, values: Record<string, string>) =>
    request<DeployArtifact>(`/api/projects/${id}/deploy/settings`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  getFirstLogin: (id: string) =>
    request<{ email: string; password: string }>(
      `/api/projects/${id}/deploy/first-login`,
    ),
  goOnline: (
    id: string,
    owner: { email: string; name: string; password: string } | null,
  ) =>
    request<{ ok: boolean }>(`/api/projects/${id}/deploy`, {
      method: "POST",
      body: JSON.stringify({ owner }),
    }),
  getDesignKit: (id: string) =>
    request<DesignKit>(`/api/projects/${id}/design-kit`),
  getStitch: () => request<StitchStatus>("/api/stitch"),
  connectStitch: (key: string) =>
    request<StitchStatus>("/api/stitch", {
      method: "PUT",
      body: JSON.stringify({ key }),
    }),
  disconnectStitch: () =>
    request<StitchStatus>("/api/stitch", { method: "DELETE" }),
  putDesignKit: (
    id: string,
    settings: Pick<
      DesignKit,
      | "colors"
      | "style_notes"
      | "avoid"
      | "mockup_format"
      | "showcase_3d"
      | "design_engine"
    >,
  ) =>
    request<DesignKit>(`/api/projects/${id}/design-kit`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  listSources: (id: string) =>
    request<SourceDoc[]>(`/api/projects/${id}/sources`),
  uploadSource: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_URL}/api/projects/${id}/sources`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as SourceDoc;
  },
  /** Opens a website (the owner's or one they like) and saves its text and a screenshot for the plan. */
  addSourceLink: (id: string, url: string) =>
    request<{ name: string; url: string; title: string }>(
      `/api/projects/${id}/sources/link`,
      {
        method: "POST",
        body: JSON.stringify({ url }),
      },
    ),
  deleteSource: (id: string, file: string) =>
    request<SourceDoc[]>(
      `/api/projects/${id}/sources/${encodeURIComponent(file)}`,
      { method: "DELETE" },
    ),
  uploadDesignFile: async (
    id: string,
    kind: DesignFileKind,
    file: File,
    tag: PhotoTag = "other",
  ) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("tag", tag);
    body.append("file", file);
    const response = await fetch(
      `${API_URL}/api/projects/${id}/design-kit/files`,
      { method: "POST", body },
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as DesignKit;
  },
  tagDesignPhoto: (id: string, file: string, tag: PhotoTag) =>
    request<DesignKit>(
      `/api/projects/${id}/design-kit/photos/${encodeURIComponent(file)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ tag }),
      },
    ),
  deleteDesignFile: (id: string, kind: DesignFileKind, file: string) =>
    request<DesignKit>(
      `/api/projects/${id}/design-kit/files/${kind}/${encodeURIComponent(file)}`,
      { method: "DELETE" },
    ),
  /** Mockups and the owner's images, served by the backend (mockups go in a sandboxed iframe). */
  stitchOriginalUrl: (id: string, name: string) =>
    `${API_URL}/api/projects/${id}/design/stitch/${encodeURIComponent(name)}`,
  previewUrl: (id: string, path: string) =>
    `${API_URL}/api/projects/${id}/preview/${path}`,
  downloadUrl: (id: string) => `${API_URL}/api/projects/${id}/download`,
  getKeys: (id: string) => request<ProjectKeys>(`/api/projects/${id}/keys`),
  setKeys: (id: string, values: Record<string, string>) =>
    request<ProjectKeys>(`/api/projects/${id}/keys`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  addKey: (
    id: string,
    key: { name: string; purpose: string; secret: boolean; value: string },
  ) =>
    request<ProjectKeys>(`/api/projects/${id}/keys`, {
      method: "POST",
      body: JSON.stringify(key),
    }),
  editKey: (
    id: string,
    name: string,
    key: { name: string; purpose: string; secret: boolean },
  ) =>
    request<ProjectKeys>(
      `/api/projects/${id}/keys/${encodeURIComponent(name)}`,
      {
        method: "PATCH",
        body: JSON.stringify(key),
      },
    ),
  removeKey: (id: string, name: string) =>
    request<ProjectKeys>(
      `/api/projects/${id}/keys/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    ),
  getClaudeAccounts: () => request<ClaudeAccounts>("/api/claude/accounts"),
  addClaudeAccount: (name: string, token: string) =>
    request<ClaudeAccounts>("/api/claude/accounts", {
      method: "POST",
      body: JSON.stringify({ name, token }),
    }),
  chooseClaudeAccount: (id: string | null) =>
    request<ClaudeAccounts>("/api/claude/accounts/active", {
      method: "PUT",
      body: JSON.stringify({ id }),
    }),
  removeClaudeAccount: (id: string) =>
    request<ClaudeAccounts>(`/api/claude/accounts/${id}`, { method: "DELETE" }),
  getFlowchart: (id: string) =>
    request<FlowchartInfo>(`/api/projects/${id}/scope/flowchart`),
  generateFlowchart: (id: string) =>
    request<FlowchartInfo>(`/api/projects/${id}/scope/flowchart`, {
      method: "POST",
    }),
  eventsUrl: (runId: string) => `${API_URL}/api/runs/${runId}/events`,
};

/** The Design Strategist's plan (docs/03-design/blueprint.json): what the design follows, approved before styles. */
export interface DesignPlan {
  status: "draft" | "approved";
  approved_at?: string;
  summary: string;
  candidates: { part: string; products: string[]; why: string }[];
  main_screen: { path: string; description: string };
  navigation: {
    type: string;
    items: string[];
    mobile: string;
    follows?: string;
  };
  pages: {
    path: string;
    name: string;
    kind: string;
    follows: string;
    source: string;
    layout: string;
    changes?: string;
  }[];
  joins: string[];
  decisions: { topic: string; chosen: string; source: string; why: string }[];
  not_taken?: string[];
}

export interface DesignPlanInfo {
  plan: DesignPlan | null;
  /** True while the plan must be approved before any style is drawn. */
  needed: boolean;
  /** Products like this website, from the project's own research. */
  candidates: {
    product: string;
    url?: string;
    for: string;
    patterns: string[];
    vs_guide: string;
    note: string;
  }[];
  /** The library guides used, with the products each was researched from. */
  guides: Record<string, string[]>;
}
