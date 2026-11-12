"""Schema for Stage 1's output, docs/01-scope.json."""

from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator


class Business(BaseModel):
    name: str = ""
    industry: str = ""
    description: str = ""
    location: str = ""
    target_customers: list[str] = []
    goals: list[str] = []
    languages: list[str] = []


class Role(BaseModel):
    name: str
    description: str = ""


# What kind of page it is: decides its layout (from the page-type guides), not its style.
PAGE_TYPES = ("landing", "content", "listing", "detail", "chat", "dashboard", "form", "docs", "account", "admin", "auth",
              "board", "editor", "calendar", "inbox")


class Page(BaseModel):
    name: str
    path: str = ""
    purpose: str = ""
    type: str = ""  # one of PAGE_TYPES
    roles: list[str] = []
    sections: list[str] = []


class Feature(BaseModel):
    id: str
    name: str
    description: str = ""
    priority: Literal["must", "should", "could"] = "must"
    roles: list[str] = []
    pages: list[str] = []
    done_when: list[str] = []  # plain checks the owner can try, e.g. "I get an email for each request"


class Entity(BaseModel):
    name: str
    description: str = ""
    fields: list[str] = []


class Branding(BaseModel):
    tone: str = ""
    colors: list[str] = []
    style_notes: str = ""


# The business side of the plan (the owner's project brief). Every part is optional so plans
# written before it existed still load; the Stage 1 hook asks for the key parts before "ready".

class MainAction(BaseModel):
    label: str = ""  # the one thing visitors should do, e.g. "Request a table"
    why: str = ""


class Goal(BaseModel):
    goal: str
    measure: str = ""  # how the owner will know it worked, e.g. "20+ online requests a month"


class CustomerType(BaseModel):
    name: str
    needs: list[str] = []  # what they come to the site to find out or do


class BusinessValue(BaseModel):
    proposition: str = ""  # why customers pick this business, in one sentence
    revenue: list[str] = []  # how the site helps bring in money
    saves: list[str] = []  # time or cost the site saves the owner
    competitors: list[str] = []  # competitors or sites the owner likes


class Running(BaseModel):
    updates: list[str] = []  # who keeps what up to date, e.g. "Owner: menu and prices"
    monthly_cost: str = ""  # rough running cost in plain words
    notes: str = ""


class Cost(BaseModel):
    item: str
    amount: str = ""  # plain text, e.g. "Free", "about ₩15,000"
    period: Literal["once", "month", "year"] = "month"


class Economics(BaseModel):
    costs: list[Cost] = []
    expected_return: str = ""  # e.g. "20 bookings a month x ₩15,000 average = about ₩300,000"
    payback: str = ""  # e.g. "Covers its cost in the first month"
    basis: str = ""  # what the estimate assumes, so the owner can correct it


class Discovery(BaseModel):
    channel: str  # e.g. "Naver Place", "Kakao Map", "Instagram", "Google"
    action: str = ""  # what to set up or link


class OwnerTime(BaseModel):
    task: str
    time: str = ""  # e.g. "about 10 minutes a day"


class Milestone(BaseModel):
    step: str
    when: str = ""  # e.g. "Week 1"
    who: str = ""  # "You", "Gagesite", "Together"


class Launch(BaseModel):
    owner_time: list[OwnerTime] = []
    timeline: list[Milestone] = []


class Brief(BaseModel):
    main_action: MainAction = MainAction()
    goals: list[Goal] = []
    customers: list[CustomerType] = []
    value: BusinessValue = BusinessValue()
    running: Running = Running()
    economics: Economics = Economics()
    discovery: list[Discovery] = []
    launch: Launch = Launch()


# How people use the site, for the later stages: who may do what, the step-by-step flows,
# how important things change state, and every message the site sends.

class Permission(BaseModel):
    action: str  # e.g. "Request a table"
    roles: list[str] = []  # role names allowed to do it


class FlowStep(BaseModel):
    actor: str  # a role name, or "System" for what the site does by itself
    page: str = ""  # page name where it happens ("" for emails and background work)
    action: str
    result: str = ""


class FlowProblem(BaseModel):
    when: str  # e.g. "The chosen time is already full"
    then: str  # e.g. "Show the next free times"


class Flow(BaseModel):
    id: str
    name: str
    role: str  # who starts it
    goal: str = ""
    features: list[str] = []  # feature ids this flow uses
    steps: list[FlowStep] = []
    problems: list[FlowProblem] = []


class StateChange(BaseModel):
    from_state: str = Field("", alias="from")
    to: str
    trigger: str = ""  # e.g. "Owner confirms"

    model_config = {"populate_by_name": True}


class LifecycleState(BaseModel):
    name: str
    meaning: str = ""


class Lifecycle(BaseModel):
    thing: str  # e.g. "Reservation"
    states: list[LifecycleState] = []
    changes: list[StateChange] = []


# The real details that go on the website (contact page, footer), collected in the chat.

class OpeningHours(BaseModel):
    days: str  # e.g. "Mon-Fri", "Every day"
    time: str = ""  # e.g. "10:00-22:00", "Closed"


class Link(BaseModel):
    name: str  # e.g. "Instagram"
    url: str = ""


class DetailItem(BaseModel):
    label: str
    value: str = ""
    hint: str = ""  # what exactly is needed, e.g. "Delivery fee and free-delivery threshold"


# Standard fields that may not apply to every business (an online-only shop has no street
# address or opening hours). Phone, email and the business name always apply.
SKIPPABLE_DETAILS = ("address", "hours", "links", "representative", "registration_number", "domain")


class Details(BaseModel):
    phone: str = ""
    email: str = ""
    address: str = ""
    hours: list[OpeningHours] = []
    links: list[Link] = []
    legal_name: str = ""
    representative: str = ""
    registration_number: str = ""
    domain: str = ""
    other: list[DetailItem] = []  # business-specific details, e.g. shipping fee, stylists, licence number
    not_needed: list[Literal[SKIPPABLE_DETAILS]] = []  # standard fields that don't apply to this business


class DataStorage(BaseModel):
    """Whether the site needs a database at all (a brochure site with a contact form does not)."""

    needs_database: bool | None = None  # None until Claude can tell
    why: str = ""
    # Where the owner's information lives today: "database" (an existing database they can connect),
    # "spreadsheets", "other" (paper, an app, a booking platform...), or "" when not known.
    existing: Literal["", "database", "spreadsheets", "other"] = ""


class ExistingSite(BaseModel):
    """A website the owner linked: their own current site (rebuild it, closely) or one they like (ideas only)."""

    url: str = ""
    owned: bool | None = None  # True: the owner's own site; False: someone else's; None: not asked yet
    keep: str = ""  # what to keep, fix or add compared with it, in the owner's words


class Notification(BaseModel):
    name: str
    to: str  # role name or "Customer"
    when: str = ""
    channel: Literal["email", "screen", "sms", "kakao"] = "email"


class SamplePhoto(BaseModel):
    url: str
    thumb: str = ""
    credit: str = ""


class ContentItem(BaseModel):
    item: str
    detail: str = ""
    status: Literal["needed", "provided", "placeholder"] = "needed"
    kind: Literal["image", "text", "info"] = "info"
    files: list[str] = []  # images the owner uploaded for this item (in brand/)
    sample_keywords: str = ""  # English search words for sample photos, e.g. "cafe,latte"
    samples: list[SamplePhoto] = []  # sample photos the owner chose to use for now


class ComplianceItem(BaseModel):
    item: str
    why: str = ""


class KeyItem(BaseModel):
    """A key or setting the website reads (e.g. MODEL_API_KEY). Names only: values never go in the plan."""

    name: str
    purpose: str = ""
    secret: bool = True
    required: bool = True


class Scope(BaseModel):
    version: int = 1
    status: Literal["draft", "ready"] = "draft"
    business: Business = Business()
    details: Details = Details()
    brief: Brief = Brief()
    site_type: str = ""
    # What kind of website it is (research-lab, portfolio, restaurant-cafe...): decides what to show first.
    site_category: str = ""
    # Other kinds it combines (a to-do + notes app: todo-tasks, notes-docs): each gets its own guide.
    site_categories: list[str] = []
    roles: list[Role] = []
    pages: list[Page] = []
    features: list[Feature] = []
    business_rules: list[str] = []
    permissions: list[Permission] = []
    flows: list[Flow] = []
    lifecycles: list[Lifecycle] = []
    notifications: list[Notification] = []
    data_storage: DataStorage = DataStorage()
    existing_site: ExistingSite = ExistingSite()
    entities: list[Entity] = []
    integrations: list[str] = []
    keys: list[KeyItem] = []
    branding: Branding = Branding()
    content_checklist: list[ContentItem] = []
    compliance: list[ComplianceItem] = []
    assumptions: list[str] = []
    open_questions: list[str] = []

    @model_validator(mode="after")
    def ready_means_complete(self) -> "Scope":
        if self.status == "ready":
            if not self.business.name:
                raise ValueError("status is 'ready' but business.name is empty")
            if not self.pages:
                raise ValueError("status is 'ready' but there are no pages")
            if not self.features:
                raise ValueError("status is 'ready' but there are no features")
        return self


def validate_scope(raw: dict) -> tuple[Scope | None, list[str]]:
    try:
        return Scope.model_validate(raw), []
    except ValidationError as exc:
        errors = []
        for err in exc.errors():
            location = ".".join(str(part) for part in err["loc"]) or "(root)"
            errors.append(f"{location}: {err['msg']}")
        return None, errors
