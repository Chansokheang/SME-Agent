// npm run design-shot -- directions/1.html ...  ->  design_shot.py with the platform's Python
// (it has the headless browser). Gagesite sets GAGESITE_PYTHON for every run.
const { spawnSync } = require("child_process");
const path = require("path");

const python = process.env.GAGESITE_PYTHON || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, [path.join(__dirname, "design_shot.py"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});
process.exit(result.status ?? 1);
