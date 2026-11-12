"""Stage definitions: what each stage is called and how its `claude -p` runs are configured."""

from dataclasses import dataclass, field, replace


# The only shell commands Stage 4 may run, each exactly `npm run site:<name>` (scripts in the
# workspace's package.json). Listed one by one: in a permission rule, a trailing ":*" means
# "followed by more words", which never matches names that contain their own colon.
SITE_SCRIPTS = ("install", "db", "seed", "typecheck", "lint", "build", "check", "motion")
# "UI + dedicated API": the separate API service's commands (service.cjs).
SERVICE_SCRIPTS = ("install", "db", "seed", "typecheck")


@dataclass(frozen=True)
class Stage:
    key: str
    order: int
    title: str
    description: str
    implemented: bool = False
    model: str = "sonnet"
    max_turns: int = 30
    allowed_tools: list[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Glob", "Grep"])
    # Tools refused outright. Stages read and write files only: no shells, no web, no sub-agents.
    disallowed_tools: list[str] = field(default_factory=lambda: ["Bash", "PowerShell", "WebFetch", "WebSearch", "Task"])
    # Files in pipeline/stages/<key>/ appended to the system prompt, in order.
    prompt_files: list[str] = field(default_factory=lambda: ["system.md"])
    # Set for the agent-team build: "advisor", "dev" or "qa". Empty for a stage's own chat.
    role: str = ""
    # Extra MCP servers for the run (JSON for --mcp-config), e.g. Google Stitch for UI Design.
    mcp_config: str = ""
    # Names the combined prompt file when the same stage runs with different extras.
    variant: str = ""


STAGES: list[Stage] = [
    Stage(
        key="01-scope",
        order=1,
        title="Feature Analysis & Scope",
        description="Chat about your business and agree on what the website must do.",
        implemented=True,
        model="opus",
        max_turns=20,
    ),
    Stage(
        key="02-database",
        order=2,
        title="Database Design",
        description="Decide what information the website stores and how it connects.",
        implemented=True,
        model="opus",
        max_turns=30,
    ),
    Stage(
        key="03-design",
        order=3,
        title="UI Design",
        description="Pick one of three looks, then agree its components and the key pages.",
        implemented=True,
        model="opus",
        max_turns=80,
        prompt_files=["system.md", "design-rules.md"],
        # Its only commands: find openly licensed photos, and screenshot its own previews to
        # check them (no other shell, no web browsing).
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash(npm run design-images:*)",
                       "Bash(npm run design-shot:*)"],
        disallowed_tools=["PowerShell", "WebFetch", "WebSearch", "Task"],
    ),
    Stage(
        key="04-build",
        order=4,
        title="Implementation",
        description="Build the working website: pages, logins and admin tools.",
        implemented=True,
        model="opus",
        max_turns=250,
        # Building needs a shell, but only for the fixed commands in the workspace's package.json
        # (install, database, typecheck, lint, build). Everything else stays refused.
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", *(f"Bash(npm run site:{name})" for name in SITE_SCRIPTS),
                       *(f"Bash(npm run service:{name})" for name in SERVICE_SCRIPTS)],
        disallowed_tools=["PowerShell", "WebFetch", "WebSearch", "Task"],
        # The design rules (shared with UI Design) plus the small-business overrides, so the built
        # pages keep the approved design's quality instead of drifting to generic defaults.
        prompt_files=["system.md", "../03-design/design-rules.md", "taste.md"],
    ),
    Stage(
        key="05-deploy",
        order=5,
        title="Deployment",
        description="Put the website online in your own Vercel account.",
        implemented=True,
        model="opus",
        max_turns=120,
        # Getting ready and fixing a failed attempt: the same fixed commands as building.
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", *(f"Bash(npm run site:{name})" for name in SITE_SCRIPTS),
                       *(f"Bash(npm run service:{name})" for name in SERVICE_SCRIPTS)],
        disallowed_tools=["PowerShell", "WebFetch", "WebSearch", "Task"],
    ),
]

STAGES_BY_KEY = {stage.key: stage for stage in STAGES}


def landing_stage(stage: Stage) -> Stage:
    """Implementation with the landing page builder's instructions (setup "landing"): one
    commercial, modern page, art-directed by the build itself when UI Design was skipped."""
    if stage.role == "api_dev" or "landing.md" in stage.prompt_files:
        return stage
    return replace(stage, variant="landing", prompt_files=[*stage.prompt_files, "landing.md"])

# Stage 4 as an agent team (docs/plans/stage4-agent-team.md): one job per agent, each with
# its own instructions and tools. The platform, not the agents, moves tasks between them.
_BUILD_READ = ["Read", "Glob", "Grep"]
# The Developer runs the self-test too, before handing over: QA then tests independently. Without it the
# Developer couldn't see problems only the self-test shows, and bounced the same bug back and forth.
_DEV_SCRIPTS = ("install", "db", "seed", "typecheck", "lint", "build", "check", "motion")
BUILD_ROLES: dict[str, Stage] = {
    "advisor": Stage(
        key="04-build", order=4, title="Implementation: Advisor", description="Plans the build as tasks.",
        implemented=True, model="opus", max_turns=40, role="advisor",
        allowed_tools=[*_BUILD_READ, "Write", "Edit"],
        disallowed_tools=["Bash", "PowerShell", "WebFetch", "WebSearch", "Task"],
        prompt_files=["system.md", "roles/advisor.md"],
    ),
    "dev": Stage(
        key="04-build", order=4, title="Implementation: Developer", description="Builds one task at a time.",
        implemented=True, model="opus", max_turns=120, role="dev",
        allowed_tools=[*_BUILD_READ, "Write", "Edit", *(f"Bash(npm run site:{name})" for name in _DEV_SCRIPTS),
                       *(f"Bash(npm run service:{name})" for name in SERVICE_SCRIPTS)],
        disallowed_tools=["PowerShell", "WebFetch", "WebSearch", "Task"],
        prompt_files=["system.md", "../03-design/design-rules.md", "taste.md", "roles/dev.md"],
    ),
    # "UI + dedicated API": a second developer builds the service/ lane while the Developer
    # builds the site/ lane. It only runs the service's own commands.
    "api_dev": Stage(
        key="04-build", order=4, title="Implementation: API Developer", description="Builds the API service tasks.",
        implemented=True, model="opus", max_turns=120, role="api_dev",
        allowed_tools=[*_BUILD_READ, "Write", "Edit", *(f"Bash(npm run service:{name})" for name in SERVICE_SCRIPTS)],
        disallowed_tools=["PowerShell", "WebFetch", "WebSearch", "Task"],
        prompt_files=["system.md", "roles/api-dev.md"],
    ),
    "qa": Stage(
        key="04-build", order=4, title="Implementation: QA", description="Tests each finished task.",
        # QA writes only its verdict file: no Edit, and its only command is the self-test.
        implemented=True, model="sonnet", max_turns=40, role="qa",
        allowed_tools=[*_BUILD_READ, "Write", "Bash(npm run site:check)"],
        disallowed_tools=["Edit", "PowerShell", "WebFetch", "WebSearch", "Task"],
        prompt_files=["system.md", "../03-design/design-rules.md", "taste.md", "roles/qa.md"],
    ),
}

# Stage 1's workflow flowchart: a business analyst reads the gathered requirements and writes
# docs/01-flowchart.json, which the app draws. Started by the owner once the plan is ready.
SCOPE_FLOWCHART = Stage(
    key="01-scope", order=1, title="Workflow flowchart", description="Draws the whole website as one flowchart.",
    implemented=True, model="opus", max_turns=20, role="flowchart",
    allowed_tools=["Read", "Glob", "Grep", "Write"],
    disallowed_tools=["Edit", "Bash", "PowerShell", "WebFetch", "WebSearch", "Task"],
    prompt_files=["flowchart.md"],
)

# Landing pages: the Motion Director writes the scroll storyboard (docs/04-storyboard.json) before
# any code, and revises it with the owner until they press "Build from this storyboard". Files only.
MOTION_DIRECTOR = Stage(
    key="04-build", order=4, title="Motion Director", description="Storyboards the landing page's scroll story.",
    implemented=True, model="opus", max_turns=40, role="director",
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep"],
    disallowed_tools=["Bash", "PowerShell", "WebFetch", "WebSearch", "Task"],
    prompt_files=["landing.md", "roles/director.md"],
)

# Before UI Design: a researcher studies the leading products of each kind of website or page the
# plan needs that has no guide yet, and writes the guide (reused by every later project). The only
# run with web access; it works in its own folder (no hooks) and can only write the guides there.
PATTERN_RESEARCH = Stage(
    key="03-design", order=3, title="Design research", description="Studies the leading products of this kind.",
    implemented=True, model="opus", max_turns=120, role="research",
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
    disallowed_tools=["Bash", "PowerShell", "Task"],
    prompt_files=["research.md"],
)

# Every project, before its design plan: studies THIS project's mix of products (beyond the library
# guides, which stay the baseline). Web access, its own folder; the results are copied into the project.
PROJECT_RESEARCH = Stage(
    key="03-design", order=3, title="Project research", description="Studies products like this website.",
    implemented=True, model="opus", max_turns=80, role="project-research",
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
    disallowed_tools=["Bash", "PowerShell", "Task"],
    prompt_files=["research-project.md"],
)

# The Design Strategist: picks the products to follow and plans how they merge into one design
# (docs/03-design/blueprint.json), which the owner approves before any style is drawn. Files only.
DESIGN_STRATEGIST = Stage(
    key="03-design", order=3, title="Design plan", description="Plans the layout and flow from the research.",
    implemented=True, model="opus", max_turns=40, role="strategist",
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep"],
    disallowed_tools=["Bash", "PowerShell", "WebFetch", "WebSearch", "Task"],
    prompt_files=["strategist.md"],
)
