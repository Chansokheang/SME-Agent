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
  const env = { ...process.env, ...dotenv(), ...extraEnv, PYTHONIOENCODING: "utf-8" };
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
