# Research notes: AUTH pages (sign in, reset password, first sign-in)

## Scope
- Products and systems studied: Linear, Vercel, Stripe, Notion (sign-in pages are widely
  copied; observed as publicly visible pages and through third-party teardowns, not
  fetched for this run), PatternFly (Red Hat's design system login page), plus
  engineering guidance from web.dev (Google) and OWASP.
- As of: November 2026.
- Method: public docs, design systems and UX write-ups. No sign-in or form was submitted.

## Sources
- [WEBDEV] web.dev, "Sign-in form best practices":
  https://web.dev/articles/sign-in-form-best-practices
- [OWASP] OWASP Authentication Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- [PF-LOGIN] PatternFly, Login page design guidelines:
  https://www.patternfly.org/components/login-page/design-guidelines
- [LOGROCKET] LogRocket, "Essential elements of a login screen":
  https://blog.logrocket.com/ux-design/essential-elements-login-screen
- [LOGIN-EXAMPLES] Third-party galleries of minimal SaaS login pages (SaaSFrame,
  shadcn blocks, Eleken), via search summary:
  https://www.saasframe.io/examples/unkey-login , https://www.eleken.co/blog-posts/login-page-examples

## Findings

### Layout of leading sign-in pages
- Minimal SaaS sign-in pages (Linear, Vercel, Notion and their many clones) centre a
  single narrow form on a plain background, with the logo above, a short title, and a
  link to sign up or get help below. There is no site navigation (inferred from the
  publicly visible pages; [LOGIN-EXAMPLES] documents the same centred-card pattern).
- Stripe's sign-in page uses a centred card on a lightly decorated background (inferred,
  observed).
- Notion offers many methods (Google, Apple, Microsoft, passkey, SSO, email)
  (src: [LOGIN-EXAMPLES]). A guideline: limit to 2-3 methods to avoid clutter
  (src: [LOGIN-EXAMPLES]).
- Show only the identifier, password and button at the top, so the phone keyboard does not
  hide the button. Or use two steps (email, then password) (src: [WEBDEV]).
- Logo and branding on the sign-in page, restrained (src: [WEBDEV], [LOGROCKET]).
- PatternFly order: title -> username -> password (optional show/hide) -> up to 3 more
  fields -> optional checkbox -> "Log in" button -> social buttons -> sign-up link
  (src: [PF-LOGIN]).

### Fields
- Email: `type="email"`, `autocomplete="username"`. Password: `autocomplete="current-
  password"`, stable `id`/`name`. New password: `autocomplete="new-password"`
  (src: [WEBDEV]).
- Labels above inputs, never placeholders as labels (src: [WEBDEV], [LOGROCKET]).
- Show-password toggle: `type="button"`, label updates, masked by default
  (src: [WEBDEV], [LOGROCKET]).
- Allow paste, support password managers, one Tab from username to password
  (src: [OWASP]).
- Caps-lock warning is a good pattern (src: [LOGROCKET]).
- Don't ask for email or password twice (src: [WEBDEV]).
- Touch targets at least 44x44px. 16px+ font (prevents iOS zoom). Visible input borders
  (src: [WEBDEV]).

### Button and links
- The button says the action: "Sign in" / "Log in", not "Submit" (src: [WEBDEV], [PF-LOGIN]).
- Don't disable the button while fields are empty. Validate on submit and explain
  (src: [WEBDEV]). Disable it briefly after a click to prevent double submits (src: [WEBDEV]).
- "Forgot password?" link near the password field (src: [WEBDEV], [PF-LOGIN]).
- One visually dominant button (src: [LOGROCKET]).

### Errors and security
- Use one generic failure message for wrong email OR wrong password, e.g. OWASP's "Login
  failed; Invalid user ID or password." Status code and timing must match too
  (src: [OWASP]). PatternFly suggests "Incorrect username or password" (src: [PF-LOGIN]).
- Reset response must not reveal whether the email exists: "If that email address is in
  our database, we will send you an email..." (src: [OWASP]).
- Lock out or throttle per account, not per IP. Exponential delay. Keep password recovery
  open for locked accounts to avoid denial of service (src: [OWASP]).
- Passwords: allow at least 64 characters, all characters including spaces, no
  composition rules, check against breached lists. Minimum 8 with MFA, 15 without
  (src: [OWASP]). Minimum 8 + breached-list check is the common small-site convention
  (inferred).
- Client-side errors inline under the field. Server errors in an alert under the title,
  with the password field cleared. Locked / expired-session notices above the form
  (src: [PF-LOGIN]). Note: [LOGROCKET] says not to clear entered data. Reconcile by
  keeping the email and clearing only the password (inferred).
- Errors must be announced to screen readers (src: [LOGIN-EXAMPLES] via search summary;
  inferred standard practice).

### Invite-only / members-only sites
- When accounts are created by an admin, there is no sign-up link. Instead there is a help
  line ("Don't have an account? Ask the front desk") (inferred, follows [USERMGMT] in
  admin research).
- A first sign-in with a temporary password should force a new password set with
  `autocomplete="new-password"` (src: [WEBDEV]; inferred flow).
- Deactivated accounts get the same generic message as wrong credentials, per OWASP's rule
  that disabled accounts must not be revealed (src: [OWASP]). A softer alternative some
  sites choose for members-only venues: direct the person to the venue staff after failure
  (src: [OWASP] notes critical apps may direct users to support).

### Where products differ
- One-step (email + password together) vs two-step (email -> continue -> password /
  method). Two-step suits sites with SSO or passkeys; one-step is simpler and better for
  password-only small sites (inferred, [WEBDEV]).
- Split screen (form + brand image) vs single centred column. Both are common; the
  centred column is the safer default, and split screen is a style choice (inferred).
