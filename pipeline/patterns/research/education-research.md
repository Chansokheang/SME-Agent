# Research notes: EDUCATION sites (academies, language schools, course providers)

Scope: public course catalogues, course detail pages, homepages and placement flows of
Coursera, Lingoda, British Council (English courses, several country sites), EF (EF SET
level test), ABA English, plus NN/g's university-website usability research. Researched
November 2026. Udemy, edX and the British Council main site were tried but blocked or
timed out; nothing below is drawn from them.

## Sources
- [COURSERA-DETAIL] Coursera course page (Supervised Machine Learning): https://www.coursera.org/learn/machine-learning
- [COURSERA-BROWSE] Coursera browse/category page: https://www.coursera.org/browse
- [COURSERA-CAT] Coursera "English" category page: https://www.coursera.org/courses?query=english
- [LINGODA-HOME] Lingoda homepage: https://www.lingoda.com/en/
- [BC-LEVELS] British Council Thailand adult levels (via search summary): https://www.britishcouncil.or.th/en/english-courses/adults/levels
- [BC-TEST] British Council Spain level test booking: https://britishcouncil.es/en/english/register/level-test
- [BC-UA] British Council Ukraine adult courses: https://www.britishcouncil.org.ua/en/english/adults
- [EF-TEST] EF SET free English test: https://www.ef.edu/test/english/
- [ABA] ABA English course page: https://learn.abaenglish.com/en/learn-english-course
- [NNG-UNI] NN/g, University Websites: Top 10 Design Guidelines: https://www.nngroup.com/articles/university-sites/
- [NNG-FAC] NN/g video, faculty pages persuade prospective students: https://www.nngroup.com/videos/university-faculty-pages/
- [NYU] NYU usability lab, Tandon Online case study: https://sites.google.com/nyu.edu/nyuusabilitylab/usability-services/case-studies/nyu-tandon-online
- [EAB] EAB, missing components of university websites: https://eab.com/resources/blog/adult-education-blog/four-critical-but-often-missing-components-of-high-performing-university-websites/
- [FILTER-SURVEY] Search over course-catalogue filter docs (ibl.ai catalog, Cademy embed filters, UT Law filter case study): https://ibl.ai/docs/lms/catalog/discover , https://cademy.io/blog/choose-course-embed-filters , https://law.utexas.edu/ux-case-studies/modern-filter-panel

## Findings

### What people come to do
- Prospective students want to find whether the school offers the course they need. 48% of
  NN/g test users missed a program that the site did offer (src: [NNG-UNI]). The full course
  list is the single most important page; link it from the main content, not only the menu
  (src: [NNG-UNI]).
- Deadlines and the steps to apply were hard to find. NN/g advises putting deadlines near
  the top of the apply page and describing the application step by step (src: [NNG-UNI]).
- Prospective students want to know who will teach them; teacher pages persuade (src: [NNG-FAC]).
- Users fall back on Google and third-party sites when facts are missing (src: [NNG-UNI]).

### Homepage pattern (language schools)
- Lingoda: promo strip, header with a Languages mega-menu that explains CEFR levels and
  offers the placement test, hero with a one-line promise, a language picker and two CTAs
  (primary "get started", secondary free trial), stats and a rating directly under the hero
  (src: [LINGODA-HOME]).
- Lingoda order below the hero: client logos, three benefit cards, method (expandable
  features), app promo, a survey stat, a 3-step "how it works" (placement test -> free
  trial -> choose a plan), three named testimonials with the level reached, FAQ, footer with
  newsletter (src: [LINGODA-HOME]).
- Free level test + free trial/class is the shared front door of language schools: Lingoda,
  ABA English, British Council Spain, EF (src: [LINGODA-HOME], [ABA], [BC-TEST], [EF-TEST]).
- Testimonials are framed as outcomes ("reached B2", "won a scholarship") rather than
  generic praise (src: [LINGODA-HOME]).

### Levels
- Levels are mapped to CEFR bands with friendly names: A1 Elementary, A2 Pre-intermediate,
  B1 Intermediate, B2 Upper-intermediate, C1 Advanced; British Council adds approximate
  IELTS equivalents (src: [BC-LEVELS]).
- British Council placement: book a free test, take it online, then a consultation that
  recommends a course; about 60 minutes in total (src: [BC-LEVELS], [BC-TEST]).
- Lingoda tells true beginners to start at A1.1 and use the test only when unsure
  (src: [LINGODA-HOME]).

### Course catalogue (listing)
- Coursera category pages: breadcrumb, intro, category tabs ("Most popular" with topic tabs),
  "Show more" expansion, cards (src: [COURSERA-BROWSE], [COURSERA-CAT]).
- Coursera card fields: thumbnail, provider logo + name, title, rating + review count,
  level, product type, duration (only on some), a status badge (src: [COURSERA-BROWSE]).
- Catalogue filters that recur: subject, level, language, format (self-paced vs
  instructor-led), price, certificate (src: [FILTER-SURVEY], [COURSERA-BROWSE]).
- Filters must survive the back button; hide filters with no matching courses; show which
  filters are applied (src: [FILTER-SURVEY]).
- NYU: long scrolling lists were tedious and on-campus vs online was hard to tell apart.
  Show format on every card (src: [NYU]).
- The best program finder sorted by level and format (src: [EAB]).

### Course detail
- Coursera above the fold: breadcrumb, title, instructors with photos, primary enrol button
  with the start date under it, enrolled count, rating, then a row of key facts (level,
  recommended experience, schedule flexibility, length x hours per week, number of modules)
  (src: [COURSERA-DETAIL]).
- Coursera sections via an in-page anchor bar: About (what you will learn, skills, details),
  Outcomes, Modules (week by week with content counts and time), Testimonials, Reviews
  (rating breakdown), FAQ; the enrol CTA repeats at the bottom (src: [COURSERA-DETAIL]).
- For live-class schools the key facts are schedule-based: days, times, start date, number
  of weeks, class size, seats left, price, location or online (inferred, from [BC-UA]
  "prebooked timetable" and [LINGODA-HOME] group vs private).

### Where the leaders differ (and what suits a small academy)
- Coursera/Udemy-type marketplaces lead with search and huge catalogues; a small academy
  has 5-20 courses, so a single filterable list beats category landing pages (inferred).
- Lingoda leads with a subscription plan; academies with fixed-term classes should lead
  with the next start dates and seats left instead (inferred).
- Placement: online self-test (EF, Lingoda) vs consultation (British Council). A small
  academy can offer a short self-check plus "not sure? ask us" (inferred).

### Conventions vs specs
All numbers in the guide (card counts per row, widths, line counts) are conventions taken
from these products and common web practice, not official specs. NN/g's 48% figure is from
an older study.
