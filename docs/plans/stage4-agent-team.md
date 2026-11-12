# Stage 4 as an agent team: Advisor, Developer, QA, Final review

Status: proposal, not built. Written 2026-11-05.

## 1. Why

Today Implementation is **one** AI session (`claude -p`, Opus, up to 250 steps per turn,
resumed with the same session id). It reads the plan, data design and UI design, keeps
its own page list in `docs/04-build.json` (`todo` / `done`), writes the code, and tests
its own work with the self-test (`site_check.py`, a headless browser). The Stop hook
(`check_stage.py`) refuses to let it finish until the final self-test on the production
build passes.

That works, but the same agent writes the code **and** judges it, and on big sites its
memory fills up. The team version separates planning, building and testing, so each
agent has one job, a small context, and is checked by someone else.

## 2. Principles

1. **One job per agent.** Each role is its own `claude -p` session with its own
   instructions, its own tools and its own session id. Roles never share a session.
2. **Agents report, the backend moves the cards.** No agent changes a task's status
   directly. Each writes a report file; the backend reads it and moves the task. This
   makes "not allowed to intervene" a rule of the system, not a request.
3. **Facts before opinions.** QA runs the existing self-test and scripted checks first,
   then adds its own judgement. A bug needs steps to reproduce.
4. **The loop always ends.** Every task has an attempt cap; anything stuck goes to the
   owner in plain words.
5. **One developer, one task at a time.** No two agents ever edit `site/` at once.

## 3. The roles

| Role | Model | Reads | May write | Shell | Ends by writing |
|---|---|---|---|---|---|
| **Advisor** (planner) | Opus | plan, data design, UI design, existing `site/`, bug reports | `docs/04-tasks.json` (new tasks only), `docs/04-plan.md` | none | the task board |
| **Developer** | Opus | everything; its one assigned task and its bug reports | `site/`, `docs/04-build.json` | `npm run site:install/db/seed/typecheck/lint/build` | `docs/04-runs/<task>-dev.json` (what it changed, how to check) |
| **QA** | Sonnet | `site/` (read only), the task, its acceptance checks | `docs/04-qa/<task>.json`, `docs/04-qa/scenarios/*.json` | `npm run site:check`, `npm run site:qa` | a verdict: passed / bug found, with bugs |
| **Final reviewer** | Opus | everything | `docs/04-review.md`, new bug entries | `site:check` (final), `site:qa`, `site:build` | a verdict for the whole site |

The final reviewer **does not fix code**. It files bugs, and they go back to the
Developer through the same loop, so "only the Developer touches code" stays true.

## 4. The task board: `docs/04-tasks.json`

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "T03",
      "title": "Login page and sign-in",
      "kind": "page",                 // setup | shared | page | api | change | bug
      "pages": ["/login"],
      "depends_on": ["T01"],
      "acceptance": [
        "A test account can sign in and lands on /dashboard",
        "A wrong password shows an error under the form, not a crash",
        "The button shows a spinner while signing in"
      ],
      "status": "todo",
      "attempts": 0,
      "bugs": [
        {
          "id": "B07", "found_by": "qa", "severity": "major",
          "steps": ["Open /login", "Type a wrong password", "Press Sign in"],
          "expected": "An error message under the form",
          "actual": "The page shows 'Internal Server Error'",
          "status": "open"                // open | fixed | verified | wont_fix
        }
      ],
      "history": [{"at": "...", "by": "backend", "from": "testing", "to": "bug_found"}]
    }
  ]
}
```

**States** (only the backend changes them):

```
todo -> building -> built -> testing -> passed
                       ^                  |
                       |               bug_found -> fixing -> built (again)
                       |
              after 3 failed attempts -> blocked (owner decides)
```

- `building`/`fixing`: the Developer is working on it.
- `built`: the Developer's report says done and `site:typecheck` passes (the backend checks).
- `testing`: QA is on it.
- `passed`: QA's verdict is "passed" and the self-test for its pages is clean.
- `blocked`: 3 rounds of bug_found on the same task. The owner sees a plain summary
  and can say "try again", "skip it for now" or describe the fix.

`docs/04-build.json` stays (the build panel, screenshots, GitHub save and Deployment
read it); the backend keeps it in step with the board.

## 5. The loop (backend: `build_orchestrator.py`)

```
1. Advisor run          -> tasks (setup and shared parts first, then pages, then API)
2. while a task is todo / bug_found and none is blocked:
     pick the next one whose depends_on are all passed
     Developer run (task + its open bugs)   -> dev report
     backend: typecheck ok?  no -> back to Developer (counts as an attempt)
     QA run (task + acceptance + dev report) -> verdict
     backend: passed -> next task; bug_found -> attempts += 1, back to Developer
3. all tasks passed     -> Final reviewer run (whole site, production build)
     bugs found -> new "bug" tasks -> step 2
     clean      -> stage ready for the owner to approve
```

- **Fresh sessions per task** for Developer and QA (short context, nothing stale).
  The Advisor keeps one session for the whole stage, because it needs the history.
- **Owner messages during the build** go to the Advisor, which turns them into
  `change` tasks (or answers a question). The running task finishes first.
- **Pause / Resume / Stop** from the panel. All state lives in `04-tasks.json` plus a
  `BuildJob` row in the database, so a restart resumes at the last finished step.
- **Caps:** 3 attempts per task, a step limit per run (Advisor 40, Developer 120,
  QA 40, Reviewer 80), and a total-cost guard shown to the owner.

## 6. Enforcing "no intervening"

- **Tools per role** (the `--allowedTools` / `--disallowedTools` already used per stage):
  QA and Advisor get no `Edit` access to `site/`; only the Developer gets build scripts.
- **A per-role file guard:** the runner passes `GAGESITE_ROLE=advisor|dev|qa|review`
  to the session; a `PreToolUse` hook (`check_role.py`) refuses any Write/Edit outside
  that role's paths (table in section 3) with a short reason the agent can read.
- **Status is the backend's:** the hook also refuses edits to `status`, `attempts` and
  `history` in `04-tasks.json`; the backend validates every report file before acting.

## 7. QA tooling

- `site:check` gains `--pages /login,/dashboard`, so QA tests only its task's pages
  (the full run stays for the final review).
- New `npm run site:qa -- <scenario.json>`: a safe scenario runner (Playwright under
  the hood). QA writes scenarios as JSON steps, never code:

  ```json
  {"name": "Wrong password", "as": "logged out", "steps": [
    {"goto": "/login"},
    {"fill": {"label": "Email", "value": "admin@example.com"}},
    {"fill": {"label": "Password", "value": "wrong"}},
    {"click": {"role": "button", "name": "Sign in"}},
    {"expect_text": "Wrong email or password"},
    {"expect_no_error": true}
  ]}
  ```

  It returns pass/fail per step with a screenshot of the failing step. Scenarios are
  kept, so later tasks re-run earlier ones (a cheap regression check).

## 8. What the owner sees (Stage 4 panel)

- **Task board** replacing today's page list: columns To do / Building / Testing /
  Bug found / Passed (and Blocked when needed). A card shows the title, attempt count
  and bug count; opening it shows the acceptance checks, bug reports with screenshots,
  and the Developer's note.
- **Chat timeline** in plain words: "Planned 14 tasks", "Built the login page",
  "Testing found 1 problem on the login page: a wrong password shows an error page",
  "Fixed and passed".
- **Pause / Resume** button, and a cost and time estimate before starting.
- The preview, screenshots, GitHub save and approval bar stay as they are.

## 9. Cost and modes

- Expect roughly **2-3x** today's tokens and time (more runs, each shorter; QA on Sonnet).
- **Two modes**, chosen on the Stage 4 start panel:
  - **Quick build**: today's single agent, for simple sites (no database, few pages).
  - **Team build**: this plan; the default for sites with logins or data.

## 10. Build order (each phase ends with an end-to-end test on a sample project)

| Phase | What | Done when |
|---|---|---|
| 1 | Task board file, orchestrator loop, Advisor/Developer/QA prompts, using today's `site:check` | A sample site builds through the loop with tasks passing and one forced bug going round once |
| 2 | Role file guard (`check_role.py`), status protection, `site:check --pages`, `site:qa` scenario runner | A QA agent trying to edit `site/` is refused; scenarios catch a planted bug |
| 3 | Panel: task board, timeline, pause/resume, blocked-task dialog | The owner can follow, pause and unblock a build without the chat |
| 4 | Final reviewer, cost guard, Quick/Team choice, migration of existing projects | Crystal Bank opens with its pages converted to passed tasks; a new project runs the full team build to "ready" |

## 11. Risks

- **False bugs from QA** (flaky timing, wrong expectations): every bug needs steps and
  a screenshot; the Developer may answer "can't reproduce" once, which sends it back to
  QA to re-run before it counts as an attempt.
- **Plan changes mid-build:** change tasks may re-open passed tasks; the Advisor marks
  which ones, and QA re-tests them.
- **Cost surprises:** the guard pauses the build at the owner's limit instead of running on.
- **Windows file locks** during `site:build` while the preview runs: the orchestrator
  stops the preview before the Developer's build step, as the final test does today.

## 12. Decisions for the owner

1. Models: Opus for Advisor, Developer and Reviewer, Sonnet for QA? (Cheaper: Sonnet for the Developer too.)
2. Keep **Quick build** for simple sites? (Recommended: yes.)
3. Attempt cap per task: 3? 
4. Final reviewer only files bugs (recommended), or may it fix small things itself?
