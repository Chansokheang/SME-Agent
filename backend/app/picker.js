/* Point-and-comment picker, injected into design previews opened with ?pick=1.
   Highlights the part under the pointer, reports a click to the parent app with CSS paths for
   that part and the bigger parts around it (card, section), and draws numbered pins for
   comments the parent sends back. The parent app is on another origin, so postMessage is the
   only channel. */
(function () {
  var SECTIONS = "section,header,footer,nav,aside,[data-section]";
  var CONTROLS = "a,button,[role=button],label,select,input,textarea";
  var MEDIA = "img,svg,picture,video";
  var PARTS = MEDIA + ",h1,h2,h3,h4,h5,h6,p,li,figure,article,form,table,blockquote";
  var ACCENT = "#2266d4";

  var style = document.createElement("style");
  style.textContent = "html,body,body *{cursor:crosshair!important}";
  document.head.appendChild(style);

  function box(css) {
    var el = document.createElement("div");
    el.setAttribute("style", "position:fixed;pointer-events:none;z-index:2147483646;" + css);
    document.documentElement.appendChild(el);
    return el;
  }
  var highlight = box("display:none;border:2px solid " + ACCENT + ";background:rgba(34,102,212,.07);border-radius:10px;transition:all .08s ease-out");
  var picked = box("display:none;border:2px solid " + ACCENT + ";background:rgba(34,102,212,.12);border-radius:10px;box-shadow:0 0 0 4px rgba(34,102,212,.18)");
  var tip = box("display:none;background:" + ACCENT + ";color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:7px;white-space:nowrap");
  var layer = document.createElement("div");
  layer.setAttribute("style", "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none");
  document.documentElement.appendChild(layer);

  // The outermost thing a comment can be about: the page section, or in a single-component
  // preview (?isolate=1) the component itself.
  function rootFor(el) {
    if (window.__gsFinePick) return el.closest(".gs-inner > *");
    var section = el.closest(SECTIONS);
    if (!section || section === document.body || section.offsetHeight > window.innerHeight * 2.5) return null;
    return section;
  }

  function isBox(el) {
    var s = getComputedStyle(el);
    return s.backgroundImage !== "none" || (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") ||
      parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0 || s.boxShadow !== "none";
  }
  function meaningful(el) { return el.matches(CONTROLS) || el.matches(PARTS) || isBox(el); }
  function sameBox(a, b) {
    var r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    return Math.abs(r.left - q.left) < 3 && Math.abs(r.top - q.top) < 3 && Math.abs(r.width - q.width) < 3 && Math.abs(r.height - q.height) < 3;
  }

  // From the clicked element out to the section: the smallest meaningful part first (a button,
  // photo, heading or card), then the bigger ones around it. Wrappers of the same size are skipped.
  function chainFor(target) {
    var root = rootFor(target);
    var control = target.closest(CONTROLS);
    var chain = [];
    for (var el = control || target; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.classList.contains("gs-inner") || el.classList.contains("gs-stage")) break;
      if (el === root || meaningful(el)) {
        var last = chain[chain.length - 1];
        if (!last || !sameBox(last, el)) chain.push(el);
        else if (el === root) chain[chain.length - 1] = el;
      }
      if (el === root) break;
    }
    if (!chain.length) chain.push(target);
    if (chain.length > 4) chain = [chain[0], chain[1], chain[chain.length - 2], chain[chain.length - 1]];
    return { chain: chain, root: root };
  }

  function cssPath(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      var part = el.tagName.toLowerCase();
      if (el.id) {
        parts.unshift(part + "#" + CSS.escape(el.id));
        break;
      }
      var index = 1, sibling = el;
      while ((sibling = sibling.previousElementSibling)) if (sibling.tagName === el.tagName) index++;
      parts.unshift(part + ":nth-of-type(" + index + ")");
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  function describe(el) {
    var heading = el.querySelector && el.querySelector("h1,h2,h3,h4,legend,label");
    var text = el.getAttribute("aria-label") || el.getAttribute("alt") || (heading && heading.textContent) || el.textContent || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function kindOf(el, root) {
    if (el === root) return window.__gsFinePick ? "Whole component" : "Section";
    var tag = el.tagName.toLowerCase();
    if (tag === "a") return "Link";
    if (el.matches("button,[role=button]")) return "Button";
    if (el.matches("label,select,input,textarea")) return "Field";
    if (el.matches(MEDIA)) return "Image";
    if (/^h[1-6]$/.test(tag)) return "Heading";
    if (tag === "p" || tag === "blockquote") return "Text";
    if (tag === "li") return "Item";
    if (tag === "form") return "Form";
    if (tag === "table") return "Table";
    if (el.querySelector("h1,h2,h3,h4,h5,h6,p,img")) return "Card";
    return "Box";
  }

  // Outlines are clamped to the viewport, so a full-width section still shows all four edges.
  function place(target, el, pad) {
    var r = el.getBoundingClientRect();
    var w = document.documentElement.clientWidth, h = window.innerHeight;
    var left = Math.max(2, r.left - pad), top = Math.max(2, r.top - pad);
    var right = Math.min(w - 2, r.right + pad), bottom = Math.min(h - 2, r.bottom + pad);
    target.style.left = left + "px";
    target.style.top = top + "px";
    target.style.width = Math.max(0, right - left) + "px";
    target.style.height = Math.max(0, bottom - top) + "px";
    return { left: left, top: top };
  }

  var current = null;
  function show(el) {
    highlight.style.display = tip.style.display = "block";
    var at = place(highlight, el, 3);
    tip.textContent = kindOf(el, rootFor(el)) + " · click to comment";
    tip.style.left = Math.max(4, at.left) + "px";
    tip.style.top = (at.top > 34 ? at.top - 30 : at.top + 6) + "px";
  }

  var focused = null;
  function drawFocus() {
    if (!focused || !focused.isConnected) { picked.style.display = "none"; return; }
    picked.style.display = "block";
    place(picked, focused, 3);
  }

  document.addEventListener("mouseover", function (e) {
    current = chainFor(e.target).chain[0];
    show(current);
  }, true);
  document.addEventListener("mouseleave", function () {
    highlight.style.display = tip.style.display = "none";
  });
  window.addEventListener("scroll", function () { if (current) show(current); drawFocus(); draw(); }, true);

  // Swallow normal clicks (links, buttons, form submits) while picking.
  ["click", "submit", "mousedown"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (type !== "click") return;
      var found = chainFor(e.target);
      var chain = found.chain.map(function (el) {
        return { selector: cssPath(el), label: describe(el), tag: el.tagName.toLowerCase(), kind: kindOf(el, found.root) };
      });
      focused = found.chain[0];
      drawFocus();
      parent.postMessage({
        type: "gs-pick",
        selector: chain[0].selector,
        label: chain[0].label,
        tag: chain[0].tag,
        chain: chain,
        x: e.clientX,
        y: e.clientY
      }, "*");
    }, true);
  });

  var marks = [];
  function draw() {
    layer.innerHTML = "";
    marks.forEach(function (mark) {
      var el = document.querySelector(mark.selector);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var w = document.documentElement.clientWidth;
      var left = Math.max(2, r.left), right = Math.min(w - 2, r.right);
      var pin = document.createElement("div");
      pin.textContent = mark.n;
      pin.setAttribute("style",
        "position:absolute;left:" + (left + window.scrollX + 8) + "px;top:" + (r.top + window.scrollY + 8) + "px;" +
        "width:26px;height:26px;border-radius:50% 50% 50% 4px;background:" + ACCENT + ";color:#fff;" +
        "font:700 12px/26px system-ui,sans-serif;text-align:center;box-shadow:0 6px 16px -6px rgba(14,42,87,.6)");
      var outline = document.createElement("div");
      outline.setAttribute("style",
        "position:absolute;left:" + (left + window.scrollX) + "px;top:" + (r.top + window.scrollY) + "px;" +
        "width:" + Math.max(0, right - left) + "px;height:" + r.height + "px;border:2px dashed rgba(34,102,212,.55);border-radius:10px");
      layer.appendChild(outline);
      layer.appendChild(pin);
    });
  }
  window.addEventListener("message", function (e) {
    if (e.source !== parent || !e.data) return;
    if (e.data.type === "gs-marks") {
      marks = e.data.marks || [];
      draw();
    }
    // The app tells us which part the open comment is about (the owner may widen it to the card or section).
    if (e.data.type === "gs-focus") {
      focused = e.data.selector ? document.querySelector(e.data.selector) : null;
      drawFocus();
    }
  });
  window.addEventListener("resize", function () { draw(); drawFocus(); });
  parent.postMessage({ type: "gs-ready" }, "*");
})();
