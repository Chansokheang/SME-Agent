# Page guide: FORM (applications, contact, requests, any page whose job is data entry)

Studied: GOV.UK, Atlassian, Typeform

How the best-tested form systems lay out a page whose job is to collect information
(GOV.UK Design System, Atlassian Design System, the Typeform one-question pattern, with
NN/g and Baymard usability research). Their shared rule: one calm column, every label
visible, ask only what is needed, explain errors where they happen, and say clearly what
happens after sending. Sources: `out/research/form-research.md` (researched Nov 2026).
Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **Normal site header** (no marketing extras), then a **back link** or breadcrumb to the
  page the person came from ("Back to Business English").
- **One form column of about 560-640px** (a two-thirds column inside a 960-1100px page),
  left-aligned with the page heading, not floating in the middle of a huge card. 24px side
  padding on desktop, 16px on phones.
- **Optional context column (about 280-340px) on the right** for forms tied to a thing:
  a summary card of what is being applied for (course name, start date, schedule, price),
  a short "What happens next" list, and a contact line. On phones it moves ABOVE the form
  as a compact summary.
- **Page heading (h1)** says the task: "Apply for Business English" / "Send us a message".
  One sentence under it: how long it takes and what is needed ("Takes about 3 minutes.").
- **Sections**: group fields under small headings (e.g. "About you", "Your class", "Anything
  else?"), 32-40px between sections, 20-24px between fields.
- **Fields**:
  - Label above the field, always visible, 14-16px, medium weight; hint text under the
    label in a muted colour (13-14px), before the field, not as placeholder.
  - Inputs 44-48px tall, 1px border, radius 6-10px, 12-14px inner padding, 16px text (16px
    prevents zoom on iOS). Width matches the expected answer: full column for name and
    email, about 10-12 characters for a phone or postcode, 3-4 characters for an age.
  - Radios or segmented buttons for 2-5 options shown at once; a select only for longer
    lists; checkboxes for "choose any". Each option is a large hit area (the whole row).
  - Textarea for free text, about 4-6 rows, growing with content, with a counter only when
    there is a limit ("120 / 1000").
  - Required vs optional: mark the minority. If most fields are required, add "(optional)"
    to the few that are not; if most are optional, mark the required ones with an asterisk
    and one legend line at the top.
- **Consent**: one unticked checkbox with plain words and a link to the privacy policy
  ("I agree to <business> using my details to handle this application. Privacy policy"
  style, written for the business); separate, optional box for marketing.
- **Actions** at the end of the form, left-aligned with the fields: one primary button
  named for the action ("Send application", "Send message"), then a quiet "Cancel" text
  link. No Reset button. The button is never disabled; on press it shows a spinner and
  "Sending..." and blocks double submission.

## First screen
- The heading, the one-line expectation, the summary card (if any) and the first 2-4
  fields must all be visible without scrolling, so the form looks short and doable.
- Prefill everything known: logged-in name, email and phone; the course and date the
  person came from. Show prefilled data as editable fields, not hidden.
- Short forms (under about 10 fields) stay on ONE page. Longer or branching forms split
  into 2-4 steps with a step label ("Step 2 of 3: Your class"), a back link, a "Continue"
  button, and a final "Check your answers" step.

## States
- **Inline validation**: check a field when the person leaves it, not while they type for
  the first time; check fixed-length values (phone, postcode) when complete. Once an
  error shows, remove it the moment the input becomes valid. A small check mark for
  passwords or tricky formats only.
- **Error message**: under the label/above the input (or directly under the input,
  consistently), red text with an icon, field border thicker and red. Specific and human:
  "Enter your phone number, like 010-1234-5678", never "Invalid input".
- **Submit with errors**: an error summary box at the top of the form titled "There is a
  problem", listing each error as a link that jumps to its field; focus moves to the box;
  the browser title starts with "Error: ". Every value typed is kept.
- **Sending**: button spinner and "Sending..."; fields stay visible but read-only.
- **Server or network error**: a message above the button ("We could not send your
  application. Check your connection and try again.") with the button active again; never
  clear the form. Save drafts locally for long forms.
- **Success**: a confirmation page or replaced panel, never just a toast: a clear title
  ("Application sent"), a reference number, a summary of what was sent, what happens next
  and when ("We will contact you within 2 working days"), where to see the status, and a
  contact for problems. It should survive a refresh.
- **Not available**: when the thing applied for is full or closed, say so at the top and
  offer the alternative (waitlist, next date, contact) instead of letting people fill in a
  form that will fail.
- **Duplicates**: if this person already applied, show that and link to it.

## Check-your-answers step (for multi-step or important forms)
- A summary list: label, answer, and a "Change" link per row that goes to the field and
  returns here after saving. Grouped by section. Skipped optional answers show "Not
  provided".
- One line above the button: "By sending this you confirm the details are correct."
- Button named for the outcome ("Send application").

## Phones
- One column, full width fields with 16px page padding; the context summary collapses into
  a top card (title, date, price) with a "Details" disclosure.
- Correct keyboards: `type="email"`, `type="tel"`, `inputmode="numeric"`; `autocomplete`
  tokens (`name`, `email`, `tel`, `postal-code`) so browsers can fill them.
- The primary button full width at the end of the form; do not pin it to the screen
  bottom over the fields (it hides inputs when the keyboard opens). Use `100dvh` aware
  layouts and keep the focused field visible.
- Date and time with native pickers or simple selects; no tiny custom calendars.

## Motion
- Quiet. Focus ring and border colour transition (120-150ms). Error messages fade and
  expand in (150-200ms) without shifting the page jarringly.
- Step changes slide or fade 200-250ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`; the
  confirmation panel fades in with a single subtle check mark; no confetti.
- Respect reduced motion: no slides, simple fades only.

## Accessibility
- Every input has a real `<label for>`; hints and errors linked with `aria-describedby`;
  invalid fields `aria-invalid="true"`. Radio and checkbox groups in a `fieldset` with a
  `legend` (the question).
- Error summary is focused on submit and has `role="alert"` or receives focus with a
  heading; each item is a link to the field id.
- Required state exposed with `required` / `aria-required`, not only an asterisk.
- Keyboard order follows the visual order; Enter submits single-step forms; no timeouts
  that wipe answers.
- Contrast: text 4.5:1, input borders and focus ring 3:1 against the background.
- For Korean, Japanese, Chinese input, never validate or submit while an input method is
  composing (`isComposing`).

## What not to do
- Placeholder text as the only label, or floating labels that shrink to unreadable size.
- Two- or three-column field grids, centred forms in a heavy card with a shadow.
- Asking for data you do not need now (birthdate, full address, gender, ID number).
- Errors shown before the person has typed, or only after submit at the top with no
  inline message, or in a toast that disappears.
- Disabled submit buttons with no explanation; Reset buttons; "Submit" as the label.
- Pre-ticked consent boxes; captcha puzzles as the first thing (use invisible spam checks).
- Clearing the form on error; success shown only as a toast; no reference or next step.
