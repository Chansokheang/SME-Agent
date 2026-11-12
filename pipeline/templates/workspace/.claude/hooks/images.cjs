// Finds openly licensed photos for the design (UI Design runs: npm run design-images -- "keywords" [count]).
//
// Searches Openverse (images free for commercial use, with credits): Rawpixel's professional
// public-domain photos first, then the rest. Downloads each photo into docs/03-design/imagery/
// (so the designer can look at it before using it, and the website can ship it) and records its
// credit, licence and source in docs/03-design/imagery.json. Prints what it saved.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DIR = path.join(ROOT, "docs", "03-design", "imagery");
const LIST = path.join(ROOT, "docs", "03-design", "imagery.json");
const API = "https://api.openverse.org/v1/images/";
const AGENT = "Gagesite/0.1 (website builder)";
const MAX_BYTES = 6 * 1024 * 1024;
const MIN_WIDTH = 1200;
// Photos that would look wrong on someone else's site: brands, signage, text, art, events.
const REJECT =
  /logo|brand|advert|billboard|packag|label|screenshot|poster|flyer|drawing|illustration|cartoon|meme|mockup|vector|psd|png|text|sign|watermark|wedding|party|halloween|christmas|protest|museum|exhibit|sculpture/i;

async function search(words, source) {
  const query = new URLSearchParams({
    q: words,
    page_size: "20", // the most Openverse allows without an account
    license_type: "commercial",
    mature: "false",
    category: "photograph",
    ...(source ? { source } : {}),
  });
  const res = await fetch(`${API}?${query}`, { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Openverse answered ${res.status}`);
  const data = await res.json();
  return (data.results || []).filter((r) => {
    const about = [r.title || "", ...(r.tags || []).map((t) => t.name || "")].join(" ");
    return r.url && (r.width || 0) >= MIN_WIDTH && !REJECT.test(about);
  });
}

async function download(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(30000) });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.startsWith("image/")) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES || buffer.length < 10_000) return false;
  fs.writeFileSync(file, buffer);
  return true;
}

function slug(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "photo"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const count = Math.min(Math.max(parseInt(args[args.length - 1], 10) || 0, 0), 8);
  const words = (count ? args.slice(0, -1) : args).join(" ").trim();
  const wanted = count || 4;
  if (!words) {
    console.log('Usage: npm run design-images -- "laboratory microscope" 4');
    process.exit(1);
  }
  fs.mkdirSync(DIR, { recursive: true });
  const list = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, "utf8")) : [];
  const known = new Set(list.map((i) => i.source_url));

  const candidates = [];
  for (const source of ["rawpixel", null]) {
    try {
      for (const r of await search(words, source)) {
        if (!known.has(r.url) && !candidates.some((c) => c.url === r.url)) candidates.push(r);
      }
    } catch (e) {
      console.log(`Search failed (${source || "all sources"}): ${e.message}`);
    }
    if (candidates.length >= wanted * 2) break;
  }

  const saved = [];
  for (const r of candidates) {
    if (saved.length >= wanted) break;
    const ext = (/\.(jpe?g|png|webp)(\?|$)/i.exec(r.url) || [, "jpg"])[1].toLowerCase().replace("jpeg", "jpg");
    const file = `${slug(words)}-${list.length + saved.length + 1}.${ext}`;
    try {
      if (!(await download(r.url, path.join(DIR, file)))) continue;
    } catch {
      continue;
    }
    const license = `${(r.license || "").toUpperCase()}${r.license_version ? " " + r.license_version : ""}`.trim();
    saved.push({
      file: `imagery/${file}`,
      keywords: words,
      title: r.title || "",
      creator: r.creator || "Unknown",
      license,
      needs_credit: !["CC0", "PDM"].includes((r.license || "").toUpperCase()),
      credit: `Photo: ${r.creator || "Unknown"}, ${license} via ${r.source || "Openverse"}`,
      source_url: r.url,
      page: r.foreign_landing_url || "",
      width: r.width,
      height: r.height,
    });
  }
  fs.writeFileSync(LIST, JSON.stringify([...list, ...saved], null, 2));
  if (!saved.length) {
    console.log(`No usable photos found for "${words}". Try other, simpler English keywords.`);
    return;
  }
  console.log(`Saved ${saved.length} photo(s) for "${words}". Look at each with Read before using it:`);
  for (const s of saved) console.log(`- docs/03-design/${s.file}  (${s.width}x${s.height}, ${s.license}${s.needs_credit ? ", credit needed" : ""}) ${s.title}`);
}

main().catch((e) => {
  console.log(`Image search failed: ${e.message}`);
  process.exit(1);
});
