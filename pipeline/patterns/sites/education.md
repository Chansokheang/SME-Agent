# Site guide: EDUCATION (academies, language schools, tutoring centres, course providers)

Studied: Coursera, Lingoda, British Council, EF, ABA English

People come to an education site to answer three questions fast: "Do they teach what I
need, at my level?", "When, where and how much?", and "Who teaches it, and is it any good?"
Then they want to apply without friction and know what happens next. The leaders put the
course offer first (a catalogue one click away, levels explained in plain words), make the
next step obvious with a low-risk entry (a free level test, a trial class, a consultation),
and back everything with outcome-based proof: named students and the level or score they
reached. A small academy wins by being concrete where the big platforms are vague: real
start dates, seats left, the actual teacher's face, the real classroom. Sources:
`out/research/education-research.md` (researched Nov 2026).

## What the first screen shows
- **Header**: logo/name left; 4-6 links (Courses, Teachers, FAQ, Contact; About if needed);
  right: Log in (text link) and one filled button ("Apply" or "See courses"). The courses
  link is always first (src: NN/g finding that people miss programs that exist).
- **Hero**: one sentence saying what is taught, to whom, and where/how ("English
  conversation, business English and exam prep for adults in <city>"). One short subline.
  Primary CTA to the course list; secondary CTA to the low-risk entry (level check, trial
  class or a question). A real photo of the classroom or teachers, never stock smiles.
- **Proof strip directly under the hero**: 3-4 facts in large numbers or short phrases
  (years open, students taught, average class size, exam results or rating with source).
- **Course types visible before the second scroll**: one card per programme (e.g.
  Conversation, Business, Exam prep, Kids), each with level range, schedule summary, from-
  price and a link. This is what most visitors come for.

## The main flow, step by step
1. **Find**: home -> Courses (or straight from search to a course page).
2. **Narrow**: filter by type, level and schedule (weekday evening, weekend, online).
3. **Decide**: course detail: what you will learn, level, timetable, start date, weeks,
   class size, seats left, price, teacher, reviews, FAQ.
4. **Unsure of level?**: a link right beside the level ("Not sure of your level? Take the
   5-minute check" or "Ask us"), returning to the matching courses.
5. **Apply**: a short form (who you are, which class/start date, level, goal, consent).
   Logged-in students get it prefilled; guests can apply with an option to create an
   account at the end.
6. **Confirm**: a confirmation page with a reference, what happens next and when (e.g.
   "We will call within 2 working days to confirm your seat"), and an email copy.
7. **Follow up**: "My applications" shows each application with a status (Received, Under
   review, Accepted, Waitlisted, Rejected, Cancelled) and lets the student cancel.
8. **Admin side**: the school sees new applications first, accepts or rejects them, and
   the student is notified.

## Navigation and structure
- Public pages: Home, Courses, Course detail, Apply, Teachers, FAQ, Contact, About (optional),
  Privacy. Account pages: Sign up, Log in, My applications. Admin pages behind login with
  their own sidebar layout, never mixed into the public header.
- Header stays slim and sticky on scroll (56-64px). On phones: logo, the primary CTA as a
  compact button, and a menu button opening a full-height sheet with the same links.
- Course detail always has a breadcrumb back to Courses (with filters kept).
- Footer: address, phone, opening hours, a small map link, quick links to courses, social
  links, privacy, company/registration details. Local schools are searched by location;
  the address and hours belong on every page.
- Page titles start with the course or page name, then the school name.

## The key components
- **Course card**: optional image (16:9 or 3:2, real class photo or a calm colour block
  with the course type), type label, title, level range as a pill ("B1-B2 Intermediate"),
  schedule line ("Tue & Thu, 19:00-20:30"), next start date, duration ("8 weeks"), price,
  and a seats indicator ("4 seats left" only when it is true and low). Whole card clickable;
  one action. Show online / in-person on every card.
- **Course list**: 3 cards per row on desktop, 2 on tablet, 1 on phones; or a compact list
  view with the same fields in columns. Filters above the list as chips or dropdowns (Type,
  Level, Schedule, Format); a result count ("7 courses"); a "Clear filters" link; filters
  stored in the URL so back and share work. With fewer than 6 courses, skip filters and group
  by type instead.
- **Level explainer**: a small table or row of pills mapping school levels to CEFR (A1-C1)
  and plain descriptions ("can hold a simple conversation about familiar topics"), optional
  exam equivalents. Linked from every level pill.
- **Course detail header**: breadcrumb, title, one-line summary, key-facts row (level,
  schedule, start date, duration, class size, format, price), teacher avatar and name, and
  the Apply button. On desktop a sticky side card (about 320-360px) repeats price, next
  start date, seats and Apply; on phones a bottom bar with price and Apply.
- **Course detail body**: in-page sections with an anchor bar: Overview, What you will
  learn (4-6 bullet outcomes), Syllabus (week by week, collapsible), Schedule and dates (a
  table of upcoming intakes, each with its own Apply), Teacher, Reviews, FAQ. The Apply CTA
  repeats at the end.
- **Teacher card**: square or 4:5 photo, name, role, languages, certifications, the
  courses they teach (linked), 2-3 lines of bio. A teacher page or modal with more.
- **Testimonial**: quote of 1-3 sentences, name, course taken, and the result ("TOEIC 640 ->
  820", "now leads meetings in English"). Never anonymous five-star blocks.
- **How it works**: 3-4 numbered steps (choose a course -> apply -> we confirm -> first
  class). Removes the fear of the unknown.
- **FAQ**: grouped accordion (Courses, Fees and refunds, Levels, Schedule, Online classes),
  question as the button, all closed by default, a search box when there are more than 15.
- **Status badges** on applications: neutral for Received, blue/info for Under review,
  green for Accepted, amber for Waitlisted, red/neutral for Rejected, muted for Cancelled,
  always with the word, never colour alone.

## States and messages
- **No courses match filters**: "No courses match these filters." + Clear filters + a
  contact link ("Tell us what you need").
- **Course full**: keep the page, replace Apply with "Join the waitlist" and show the next
  intake if there is one. Never hide a full course silently.
- **Applications closed / started**: "Applications for the March intake closed on 25 Feb.
  Next intake: May." with a notify-me option.
- **Loading**: skeleton cards in the grid shape; never a blank page with a spinner.
- **Apply success**: confirmation page with reference, summary of the class chosen, what
  happens next with a time frame, and a link to My applications.
- **Already applied**: on the course page, "You applied on 3 Mar - Under review" with a
  link instead of a second Apply.
- **Cancel application**: confirm dialog stating what is cancelled and that the seat is
  released; status becomes Cancelled, not deleted.
- **Errors**: inline, specific, input kept; network errors offer Retry.

## What the leaders get right / the common mistakes to avoid
Right:
- The full course list is reachable from the first screen and from every page.
- Levels are explained in words people understand, with a way to check.
- Concrete logistics on every card: when, how long, how much, where.
- Proof tied to outcomes and real people; teachers shown as real people.
- A low-commitment first step (level check, trial, question) next to the main CTA.
- A clear "what happens next" after applying.
Mistakes:
- Prices or schedules hidden behind "contact us".
- Auto-rotating hero carousels and stock photos of graduates throwing hats.
- Insider jargon ("Track B", "Module 3") with no explanation.
- Long application forms asking for everything up front (address, birthdate, ID).
- Course pages without a date: nobody can tell whether the course is still running.
- Applying gives no confirmation, or status lives only in email.

## Style: what this kind usually looks like, and where there is room to be different
- Usual: light, friendly and trustworthy. White or warm off-white backgrounds, one confident
  brand colour (blue, green or a warm red/orange are common) for CTAs and links, a rounded
  humanist sans, generous photography of people learning, rounded cards (12-16px).
- Kids' programmes allow more colour and illustration; adult and business courses read
  better calmer and more editorial.
- Room to be different: an editorial look (a serif for headings, strong typographic hero,
  fewer pictures), a bold colour-block system where each course type has its own colour,
  or a "notebook" texture for a language school. Keep the layout conventions above; vary
  type, colour, photography and shape.
