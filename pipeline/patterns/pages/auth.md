# Page guide: AUTH (sign in, forgotten password, set a new password)

Studied: Linear, Vercel, Stripe, Notion, PatternFly

This guide covers how the leading products lay out the page where people sign in, and the
small pages around it (forgotten password, set a new password, first sign-in). Linear,
Vercel, Stripe and Notion, and the many templates that copy them, share one shape: one
narrow, centred form on a quiet page, the logo above, one primary button, and help below.
Engineering guidance from web.dev and OWASP fills in the details that make it work with
password managers and keep accounts safe. People should be signed in within seconds and
never have to think about the page. Sources: `out/research/auth-research.md` (researched Nov
2026). Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **A single centred column, 360-400px wide**, placed slightly above the vertical centre
  (about 40% from the top). It sits on the plain page background, or in a card with a
  hairline border and 32-40px padding. No site header or navigation, no footer menu.
- **From top to bottom**:
  1. The logo or business name (32-40px tall), linking to the public home page if there
     is one. 24-32px gap.
  2. Title, one line, 22-28px: "Sign in to [business name]" / "Welcome back". An optional
     muted line under it: "Members only. Use the email you gave us."
  3. Optional banner slot (only when needed): session expired, password changed, or
     account locked notices go here, above the fields.
  4. **Email** field: label "Email" above, full width, 44-48px tall.
  5. **Password** field: label "Password" on the left and a "Forgot password?" link on the
     right of the same label row. Inside the field, on the right, a Show/Hide toggle.
  6. Optional "Keep me signed in" checkbox (only if sessions are short by default).
  7. **Primary button**, full width, 44-48px: "Sign in". 
  8. Under it, 24px gap, one muted help line. For an invite-only site: "No account? Ask
     at the front desk or email hello@...". For an open site: "New here? Create an
     account".
- 16-20px between fields, labels 14px, input text 16px (prevents phone zoom).
- **Footer line** at the bottom of the page (12-13px, muted): Privacy · Terms · Help.
- **Split-screen variant** (a valid style choice): the form column on the left half,
  centred in it, with a brand photo or colour panel on the right half. The panel is
  decorative and hidden on phones. Never put text there that the person needs.

## Sign-in methods
- A small site with accounts created by the owner: **email + password on one screen**.
  It is the simplest, works with every password manager, and needs no second step.
- If social, SSO or passkeys are added, put them ABOVE as full-width secondary buttons
  ("Continue with Google"), then a divider with "or", then the email form. 3 methods at
  most.
- The two-step variant (email -> "Continue" -> password or method) is for sites that
  must route people to different sign-in methods. Otherwise skip it.

## Behaviour
- Focus goes to the email field on load (desktop only. On phones, don't pop the keyboard
  uninvited).
- Enter submits from either field. One Tab moves from email to password. Paste is
  always allowed.
- **Validate on submit**, not while typing. Empty or badly formed email shows an inline
  message under the field ("Enter your email address", "Enter an email like
  name@example.com").
- **Don't disable the button** for empty fields. Do disable it while the request is
  running and show a small spinner inside it with the label "Signing in...".
- **Wrong credentials**: one generic message in an alert under the title: "That email
  and password don't match. Try again or reset your password." The email is kept, the
  password is cleared and focused. It is the same message whether the email exists or
  not, and the same for deactivated accounts.
- **Too many attempts**: "Too many attempts. Try again in 5 minutes, or reset your
  password." The reset path always stays open.
- Caps Lock on: a small hint under the password field ("Caps Lock is on").
- After sign-in, go to where the person was headed (the page that sent them here),
  otherwise the main page. Admins land on the same main page with admin links available,
  or on the admin area if that is their only job.
- Signed-in people who open the sign-in URL are sent straight to the main page.

## The pages around it
- **Forgotten password** (`/forgot-password`): same column. Title "Reset your password",
  one line "Enter your email and we'll send you a link." Then Email, then the button "Send
  reset link", then "Back to sign in". After submit, ALWAYS show the same confirmation:
  "If an account exists for ana@..., we've sent a link. It expires in 1 hour. Check your
  spam folder." with "Back to sign in" and "Resend" (enabled after 30-60 seconds).
- **If there is no email sending** (the admin resets passwords): the "Forgot password?"
  link leads to a short page or popover: "Ask the admin to reset your password at the
  front desk or by email." Never a dead link.
- **Set a new password** (from a reset link or a first sign-in with a temporary
  password): title "Choose a new password", fields "New password" (with Show toggle and
  the rule under it: "At least 8 characters") and an optional "Confirm" (better: one
  field with Show). The button is "Save password". Afterwards, sign them in and show a
  banner "Password changed".
- **Expired or used link**: "This link has expired. Request a new one." with the button
  "Send a new link".
- **Signed out**: return to the sign-in page with a quiet banner "You've signed out."

## Phones
- Same single column, full width with 20-24px side padding, starting about 48-64px from
  the top (not vertically centred, so the keyboard doesn't push the button off-screen).
- The email field uses the email keyboard. The primary button stays visible above the
  keyboard after both fields. Inputs and button at least 48px tall.
- Split-screen image panels are dropped. The logo shrinks to about 32px.

## Look (style comes from the owner; these are the conventions to keep)
- Calm and almost empty: the page background, the form, one brand-coloured primary
  button, and links in the brand or ink colour. The brand shows in the logo, the button
  and maybe a soft background tint, pattern or photo panel. Never in the form itself.
- Inputs have a visible 1px border (at least 3:1 against the background) and a clear focus
  ring in the brand colour, with 8-10px radii (or fully rounded if the style is round).
- No illustrations of padlocks or people at laptops. No marketing copy, feature lists or
  testimonials beside a members-only sign-in.

## Motion
- The column fades in and rises 8px on load (300-400ms). That is all the entrance it
  needs.
- Error alert slides down and fades in (200ms). With reduced motion, fade only.
- The button spinner appears only after about 300ms, so fast responses don't flash.
- No shaking the form on error. It is cute once and hostile after that.

## Accessibility
- A real `<form>` with labelled inputs (`<label for>`). `type="email"` and
  `autocomplete="username"` on email, `autocomplete="current-password"` on password,
  `autocomplete="new-password"` on new passwords. Stable `id`/`name` values.
- The Show toggle is a `<button type="button">` with `aria-pressed` or a changing label
  ("Show password" / "Hide password").
- Errors: field errors linked via `aria-describedby` and `aria-invalid="true"`. The
  sign-in failure alert uses `role="alert"`, and focus moves to it (or to the password
  field, with the alert announced).
- The page `<title>` changes with state ("Sign in - [business name]", "Reset your
  password - [business name]").
- Contrast: text at least 4.5:1, including the muted help line and placeholder-free
  labels. Touch targets at least 44px.

## Looks cheap: avoid
Placeholders as labels. "Submit" or "Login" (one word, as a verb) on the button. Two
password fields on sign-in. Telling people "No account with that email" (it leaks who is a
member). A disabled grey button until both fields are filled. Shaking the form. CAPTCHA on
the first attempt. Password rules shown only after failure. A stock photo of a laptop.
Full site navigation around a members-only sign-in. A "Sign up" link on a site where only
the admin can create accounts. Clearing the email after a failed attempt.
