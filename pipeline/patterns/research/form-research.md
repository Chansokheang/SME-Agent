# Research notes: FORM pages (applications, contact forms, sign-up style data entry)

Scope: form guidance from GOV.UK Design System (question pages, error summary, check
answers, confirmation pages), Atlassian Design System (Form), the Typeform one-question
pattern, plus NN/g and Baymard usability research. Researched November 2026. Material 3
text-field guidance and Stripe Checkout docs were tried but returned no usable content.

## Sources
- [GOVUK-ERR] GOV.UK Design System, Error summary: https://design-system.service.gov.uk/components/error-summary/
- [GOVUK-Q] GOV.UK Design System, Question pages: https://design-system.service.gov.uk/patterns/question-pages/
- [GOVUK-CHECK] GOV.UK Design System, Check answers: https://design-system.service.gov.uk/patterns/check-answers/
- [GOVUK-CONF] GOV.UK Design System, Confirmation pages: https://design-system.service.gov.uk/patterns/confirmation-pages/
- [ATL-FORM] Atlassian Design System, Form usage: https://atlassian.design/components/form/usage
- [NNG-FORM] NN/g, Website Forms Usability: Top 10 Recommendations: https://www.nngroup.com/articles/web-form-design/
- [BAYMARD-INLINE] Baymard, Inline form validation: https://baymard.com/blog/inline-form-validation
- [TYPEFORM] Smashing Magazine, The Typeform story: https://www.smashingmagazine.com/2014/09/26/sci-fi-frustrations-flash-and-forms-the-typeform-story/ ; Supademo, progress bar in Typeform: https://supademo.com/blog/how-to-add-a-progress-bar-in-typeform

## Findings

### Layout
- Single column, one field per row; short related fields (city, postcode) may share a row
  (src: [NNG-FORM], [ATL-FORM]). Two columns are harder to follow, and screen-magnifier
  users miss the second (src: [ATL-FORM]).
- GOV.UK places forms in a two-thirds column (src: [GOVUK-Q], an example, not a rule).
- Labels above fields on mobile and short forms (src: [NNG-FORM]); always visible, above,
  left-aligned, no verbs (src: [ATL-FORM]).
- Group related fields into sections with a short title (src: [ATL-FORM], [NNG-FORM]).
- Field width should match the expected input length (src: [NNG-FORM]).

### Labels, hints, required
- No placeholders in place of labels; put critical info in helper text (src: [ATL-FORM],
  [NNG-FORM]).
- Atlassian: red asterisk on required fields + a legend "Required fields are marked with an
  asterisk" (src: [ATL-FORM]). NN/g: cut optional fields, and clearly mark the ones left
  (src: [NNG-FORM]). GOV.UK convention marks optional ones "(optional)" (inferred from
  wider GOV.UK practice, not fetched). Choice: mark the minority.
- State format rules before submit, not only in the error (src: [NNG-FORM]).
- Radios instead of dropdowns for 2-3 options (src: [NNG-FORM]).

### Validation and errors
- Validate on blur, not while typing a first time; validate fixed-length inputs at full
  length; once an error shows, clear it on each keystroke as soon as it is fixed
  (src: [BAYMARD-INLINE]).
- 31-32% of benchmarked sites have no inline validation (src: [BAYMARD-INLINE]).
- Positive validation (a check) helps for tricky fields like passwords (src: [BAYMARD-INLINE]).
- On submit with errors: an error summary at the top of main, above the h1, titled
  "There is a problem", each item linking to its field, same words as the inline message,
  focus moved to it, and "Error: " prefixed to the page title (src: [GOVUK-ERR]).
- Never disable the submit button; explain what to fix (src: [ATL-FORM]).
- Errors visible, specific, not colour-only; keep the user's input (src: [NNG-FORM]).

### Buttons
- One primary button whose label states the action; Cancel as a link button; no Reset
  (src: [ATL-FORM], [NNG-FORM]). Show progress (spinner) while submitting (src: [ATL-FORM]).
- GOV.UK: "Continue" (not "Next") on step pages, left-aligned (src: [GOVUK-Q]).

### Multi-step
- One thing per page is GOV.UK's default; group questions only when research supports it;
  back link at the top; test without a progress indicator first (src: [GOVUK-Q]).
- Typeform: one question in focus, Enter moves on, progress = answered/total
  (src: [TYPEFORM]). Good for surveys, slow for short practical forms (inferred).
- Check answers page before submit for small-medium transactions: summary list with
  Change links returning to the check page, a declaration above the submit button, button
  named for the action ("Accept and send") (src: [GOVUK-CHECK]).

### Confirmation
- Panel with title and reference number, what happens next and when, contact details,
  next links, a way to keep a record; let people return to it (src: [GOVUK-CONF]).

### Where they differ
- GOV.UK (one question per page) vs Atlassian (sections on one page) vs Typeform (one
  question, animated). For short business forms of 4-10 fields, a single page with sections
  is fastest; split into 2-3 steps only when the form is long or branches (inferred).

### Conventions vs specs
Pixel values in the guide (field heights 40-48px, column widths 560-640px, gaps) are common
conventions from these systems and web practice, not specs from any one source.
