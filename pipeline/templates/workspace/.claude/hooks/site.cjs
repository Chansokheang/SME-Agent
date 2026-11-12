// Runs the website commands Gagesite may use while building (the site:* scripts in package.json).
// Each runs inside site/ itself: `npm --prefix site install` would add the workspace folder as
// a dependency of the website.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const site = path.join(root, "site");
const windows = process.platform === "win32";

function run(bin, args, env = {}) {
  const done = spawnSync(bin, args, { cwd: site, stdio: "inherit", shell: windows, env: { ...process.env, ...env } });
  return done.status ?? 1;
}

const npm = (...args) => run("npm", args);
const commands = {
  install: () => npm("install", "--no-audit", "--no-fund"),
  db: () => npm("run", "db:push", "--", "--accept-data-loss"),
  seed: () => npm("run", "db:seed"),
  typecheck: () => npm("run", "typecheck"),
  lint: () => npm("run", "lint"),
  build: () => {
    // Builds into its own folder so the owner's live preview (which uses .next) keeps working,
    // then removes it: nothing uses the production build here.
    const status = run("npm", ["run", "build"], { NEXT_DIST_DIR: ".next-build" });
    fs.rmSync(path.join(site, ".next-build"), { recursive: true, force: true });
    return status;
  },
  check: () => selfTest("site_check.py"),
  // How a landing page moves as a visitor scrolls: contact sheets in docs/04-motion/.
  motion: () => selfTest("motion_check.py"),
};

function selfTest(name) {
  {
    // The self-test needs a browser, which the platform's Python has.
    const python = process.env.GAGESITE_PYTHON || (windows ? "python" : "python3");
    const script = path.join(__dirname, name);
    // One self-test at a time per website: with two developers at work (UI + API), they share
    // its build folder, ports and report. A second one waits for the first (up to 15 minutes).
    const lock = path.join(__dirname, "..", "selftest.lock");
    const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    const deadline = Date.now() + 15 * 60 * 1000;
    let said = false;
    for (;;) {
      try {
        fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
        break;
      } catch {
        let stale = true;
        try {
          stale = Date.now() - fs.statSync(lock).mtimeMs > 20 * 60 * 1000; // a crashed run's leftover
        } catch {}
        if (stale) {
          fs.rmSync(lock, { force: true });
          continue;
        }
        if (Date.now() > deadline) {
          console.error("Another self-test has been running for 15 minutes. Try again in a moment.");
          return 1;
        }
        if (!said) console.log("Waiting for the other developer's self-test to finish...");
        said = true;
        sleep(3000);
      }
    }
    try {
      const done = spawnSync(python, [script, ...process.argv.slice(3)], { cwd: root, stdio: "inherit" });
      return done.status ?? 1;
    } finally {
      fs.rmSync(lock, { force: true });
    }
  }
}

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
process.exit(command());
