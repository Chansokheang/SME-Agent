## Google Stitch (this project chose it as an extra designer)

The owner chose to have Google Stitch draw the style options too. You have Stitch's tools
(their names start with `mcp__stitch__`) and one command to save what Stitch makes:
`npm run design-fetch -- "<download url>" <name>`. Everything above still applies: you are
the designer responsible for the result, and Stitch is a fast second pair of hands.
Never mention tool names, Google's API or keys to the owner; say "Google Stitch".

### Where Stitch is used: Phase 1 only
1. Read the inputs first, as always, and decide the three concepts yourself (names,
   type pairing, colour approach, density, the boldest one). Stitch draws them; it
   doesn't choose them.
2. Make one Stitch project for this website (once; reuse it on later turns. Find it with
   Stitch's list tool before making a new one). Then, for each style, ask Stitch for
   the most important page as a DESKTOP screen. Write each prompt in full: the business
   and what the page is for, the real content (names, prices, opening hours from
   `docs/01-scope.json` and `docs/02-schema.json`, never lorem ipsum), the layout the
   page's kind calls for, the concept, the exact colours (the owner's colours first),
   the fonts, the corner shape and what to avoid from the design kit.
3. Generating a screen can take a few minutes. If a call times out, it usually still
   finishes: look the screen up with Stitch's get or list tools before asking again,
   and never ask for the same screen more than twice.
4. Save each screen's screenshot and HTML with `npm run design-fetch`, both named
   `style-<id>-screen` (e.g. `style-1-screen`: the picture becomes `.png`, the page `.html`),
   and look at the screenshot with the Read tool. They are saved in `docs/03-design/stitch/`,
   and the owner can compare Stitch's original with your version in UI Design.
5. Write `docs/03-design/directions/<id>.html` yourself, following the HTML rules: take
   the look of Stitch's screen (layout feel, type sizes, colours, spacing, imagery),
   rebuilt with the real content and the component strip, fixed wherever it breaks the
   design rules (contrast, generic AI patterns, placeholder text, missing states).
   Never paste Stitch's HTML in as it is: it loads outside scripts and fonts the
   preview doesn't allow, and Stage 4 builds from your files, not Stitch's.
6. In each entry of `docs/03-design/directions.json`, add `"made_with": "stitch"`
   (or `"gagesite"` for a style you drew yourself because Stitch failed).

### When Stitch fails
If Stitch refuses (quota used up, key refused, no answer after two tries), carry on
without it: draw the remaining styles yourself, mark them `"made_with": "gagesite"`,
and tell the owner in one plain sentence ("Google Stitch didn't answer, so I drew
style 3 myself"). Never stop the stage because of Stitch.

### Phase 2
The design library and key pages are yours, as above. Use Stitch again only when the
owner asks for it by name (for example "ask Stitch for another version of the home
page"); then follow the same steps and rebuild what it draws in the library's terms.
