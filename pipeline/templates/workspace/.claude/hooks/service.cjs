// Runs the API service commands Gagesite may use while building (the service:* scripts in
// package.json) for "UI + dedicated API": a TypeScript (Hono + Prisma) or Python (FastAPI +
// SQLAlchemy) service in service/. The service's .env is loaded for every command.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const service = path.join(root, "service");
const windows = process.platform === "win32";
const python = fs.existsSync(path.join(service, "requirements.txt"));
const venvPython = path.join(service, ".venv", windows ? "Scripts/python.exe" : "bin/python");

function dotenv() {
  const file = path.join(service, ".env");
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function run(bin, args, extraEnv = {}) {
  // The service gets only the basics a process needs (same list as service_proc.py); the AI's
  // sign-in and Gagesite's own settings stay out, so the project's .env decides.
  const SAFE = new Set(["PATH", "PATHEXT", "HOME", "USER", "USERNAME", "LOGNAME", "SHELL", "HOSTNAME", "TERM", "TZ",
    "LANG", "LANGUAGE", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "APPDATA",
    "LOCALAPPDATA", "USERPROFILE", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
    "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "PUBLIC", "ALLUSERSPROFILE", "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE", "OS", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR",
    "REQUESTS_CA_BUNDLE", "NODE_EXTRA_CA_CERTS", "NODE_OPTIONS", "PLAYWRIGHT_BROWSERS_PATH", "PYTHONIOENCODING",
    "PYTHONUTF8", "CI", "DOCKER_HOST", "DOCKER_CONFIG", "DOCKER_CONTEXT"]);
  const own = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    SAFE.has(k.toUpperCase()) || /^(LC_|XDG_|NPM_CONFIG_|COREPACK_|PUPPETEER_)/i.test(k)));
  const env = { ...own, ...dotenv(), ...extraEnv, PYTHONIOENCODING: "utf-8" };
  const done = spawnSync(bin, args, { cwd: service, stdio: "inherit", shell: windows && !python, env });
  return done.status ?? 1;
}

if (!fs.existsSync(service)) {
  console.error("There is no service/ folder: this website has no separate API service.");
  process.exit(1);
}

const npm = (...args) => run("npm", args);
const py = (...args) => run(venvPython, args);
const commands = python
  ? {
      install: () => {
        const base = process.env.GAGESITE_PYTHON || (windows ? "python" : "python3");
        if (!fs.existsSync(venvPython) && run(base, ["-m", "venv", ".venv"]) !== 0) return 1;
        return py("-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", "requirements.txt", "uvicorn");
      },
      db: () => py("scripts/db.py"),
      seed: () => py("scripts/seed.py"),
      typecheck: () => py("-c", "import compileall, sys; ok = compileall.compile_dir('app', quiet=1) and compileall.compile_dir('scripts', quiet=1); import app.main; sys.exit(0 if ok else 1)"),
    }
  : {
      install: () => npm("install", "--no-audit", "--no-fund"),
      db: () => npm("run", "db:push", "--", "--accept-data-loss"),
      seed: () => npm("run", "db:seed"),
      typecheck: () => npm("run", "typecheck"),
    };

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
process.exit(command());
