/* Component gallery, injected into the component library page opened with ?gallery=1.
   Lays every component section out as a uniform thumbnail card: the component is drawn at its
   natural design width, then scaled down to fit the card (never squeezed into a narrow layout).
   The app sends order, groups and which components are wide; clicking a card tells the app. */
(function () {
  var cardBg = getComputedStyle(document.body).backgroundColor;
  var NARROW = { width: 560, height: 220 }; // design width and preview height of a normal card
  var WIDE = { width: 1080, height: 280 };   // wide components (headers, forms, rows) span two columns

  var style = document.createElement("style");
  style.textContent = [
    "body.gs-gal > *:not(.gs-gallery){display:none!important}",
    "html,body{margin:0;min-height:0!important;background:transparent!important}",
    ".gs-gallery{box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));",
    "grid-auto-flow:row dense;gap:16px}",
    ".gs-group{grid-column:1/-1;display:flex;align-items:baseline;gap:8px;margin:20px 2px 0;",
    "font:700 13px/1 system-ui,sans-serif;color:#0e1b2c}",
    ".gs-group:first-child{margin-top:0}",
    ".gs-group span{font-weight:500;font-size:11px;color:#8494a8}",
    ".gs-card{display:flex;flex-direction:column;min-width:0;border-radius:16px;overflow:hidden;cursor:pointer;",
    "background:#fdfeff;box-shadow:0 0 0 1px rgba(14,42,87,.09),0 8px 24px -18px rgba(14,42,87,.45);",
    "transition:box-shadow .25s ease,transform .25s ease}",
    ".gs-card:hover{transform:translateY(-2px);box-shadow:0 0 0 2px #2266d4,0 20px 40px -24px rgba(14,42,87,.55)}",
    ".gs-card:focus-visible{outline:none;box-shadow:0 0 0 3px #2266d4}",
    ".gs-wide{grid-column:span 2}",
    "@media (max-width:560px){.gs-wide{grid-column:auto}}",
    /* The preview fills the card, so cards sharing a row (normal next to wide) end with their
       labels on one line instead of leaving blank space under the shorter ones. */
    ".gs-preview{position:relative;box-sizing:border-box;padding:18px;display:flex;align-items:center;flex:1 1 auto;",
    "justify-content:center;overflow:hidden;pointer-events:none}",
    ".gs-content{flex:none;transform-origin:center}",
    /* The section's own title and blurb repeat the card label: hide them in thumbnails. */
    ".gs-content > [id]{margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}",
    ".gs-content > [id] > :is(h1,h2,h3,h4):first-child, .gs-content > [id] > :is(h1,h2,h3,h4):first-child + p{display:none!important}",
    ".gs-label{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:10px 14px;",
    "border-top:1px solid rgba(14,42,87,.08);font:600 12.5px/1.3 system-ui,sans-serif;color:#0e1b2c}",
    ".gs-label b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".gs-label span{flex:none;font-weight:500;font-size:11px;color:#8494a8}"
  ].join("");
  document.head.appendChild(style);

  var grid = document.createElement("div");
  grid.className = "gs-gallery";
  document.body.appendChild(grid);
  document.body.classList.add("gs-gal");

  function report() {
    parent.postMessage({ type: "gs-size", height: Math.ceil(grid.getBoundingClientRect().height) + 2 }, "*");
  }
  new ResizeObserver(report).observe(grid);

  // Scale each component to fit its card: CSS zoom changes the layout size too, so the
  // preview area stays a fixed, uniform height whatever the component's natural size.
  var cards = [];
  function fit(card) {
    var box = card.preview;
    var availW = box.clientWidth - 36;
    var availH = Math.max(card.size.height, box.clientHeight) - 36;
    card.content.style.zoom = 1;
    var natural = card.content.getBoundingClientRect();
    var zoom = Math.min(1, availW / natural.width, availH / Math.max(natural.height, 1));
    card.content.style.zoom = String(Math.max(zoom, 0.2));
  }
  var fitAll = function () { cards.forEach(fit); };
  new ResizeObserver(fitAll).observe(grid);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

  var built = false;
  function build(items) {
    if (built) return;
    built = true;
    var counts = {};
    items.forEach(function (item) { counts[item.group] = (counts[item.group] || 0) + 1; });
    var lastGroup = null;
    items.forEach(function (item) {
      var el = document.getElementById(item.id);
      if (!el) return;
      if (item.group !== lastGroup) {
        var heading = document.createElement("div");
        heading.className = "gs-group";
        heading.textContent = item.group;
        var count = document.createElement("span");
        count.textContent = counts[item.group];
        heading.appendChild(count);
        grid.appendChild(heading);
        lastGroup = item.group;
      }
      var size = item.wide ? WIDE : NARROW;
      var card = document.createElement("div");
      card.className = "gs-card" + (item.wide ? " gs-wide" : "");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", item.name);
      var preview = document.createElement("div");
      preview.className = "gs-preview";
      preview.style.minHeight = size.height + "px";
      preview.style.background = cardBg;
      var content = document.createElement("div");
      content.className = "gs-content";
      content.style.width = size.width + "px";
      content.appendChild(el);
      preview.appendChild(content);
      var label = document.createElement("div");
      label.className = "gs-label";
      var name = document.createElement("b");
      name.textContent = item.name;
      var used = document.createElement("span");
      used.textContent = item.used ? item.used + (item.used === 1 ? " page" : " pages") : "";
      label.appendChild(name);
      label.appendChild(used);
      card.appendChild(preview);
      card.appendChild(label);
      function select() { parent.postMessage({ type: "gs-select", id: item.id }, "*"); }
      card.addEventListener("click", select);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
      grid.appendChild(card);
      cards.push({ preview: preview, content: content, size: size });
    });
    fitAll();
    report();
  }

  window.addEventListener("message", function (e) {
    if (e.source === parent && e.data && e.data.type === "gs-gallery") build(e.data.items || []);
  });
  parent.postMessage({ type: "gs-ready" }, "*");
})();
