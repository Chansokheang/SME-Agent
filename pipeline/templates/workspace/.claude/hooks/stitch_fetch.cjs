// Saves a Google Stitch screen's HTML or screenshot so UI Design can look at it
// (only when the owner chose Stitch: npm run design-fetch -- "<download url>" <name>).
//
// Stitch's tools answer with download links, not the files; UI Design can't browse, so this
// fetches one link into docs/03-design/stitch/<name>.html (or .png/.jpg/.webp for an image).
// Only Google's own hosts are allowed. Stitch's key (STITCH_API_KEY, set by Gagesite for the run)
// is sent only to googleapis.com and is never printed.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DIR = path.join(ROOT, "docs", "03-design", "stitch");
const MAX_BYTES = 8 * 1024 * 1024;
const GOOGLE = /(^|\.)(googleusercontent\.com|googleapis\.com|google\.com|gstatic\.com|withgoogle\.com)$/i;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const [link, rawName] = process.argv.slice(2);
  if (!link || !rawName) fail('Usage: npm run design-fetch -- "<download url from Stitch>" <name, e.g. style-1-home>');
  let url;
  try {
    url = new URL(link);
  } catch {
    fail("That isn't a link. Pass the download URL exactly as Stitch gave it.");
  }
  if (url.protocol !== "https:" || !GOOGLE.test(url.hostname)) fail("Only Stitch's own download links (Google hosts) can be saved.");
  const name = rawName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "screen";

  const headers = { "User-Agent": "Gagesite/0.1 (website builder)" };
  if (/(^|\.)googleapis\.com$/i.test(url.hostname) && process.env.STITCH_API_KEY) {
    headers["X-Goog-Api-Key"] = process.env.STITCH_API_KEY;
  }
  let res;
  try {
    res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(60000) });
  } catch {
    fail("Couldn't download it (no answer). Try again, or ask Stitch for the screen again to get a fresh link.");
  }
  if (!res.ok) fail(`The download answered ${res.status}. Links expire: ask Stitch for the screen again to get a fresh one.`);
  let buffer = Buffer.from(await res.arrayBuffer());
  let type = (res.headers.get("content-type") || "").toLowerCase();
  // Stitch's links often answer with a wrapper: {"dataString": <the page, or the picture in base64>,
  // "imageMetadata": {"mimeType": "png"}}. Keep what is inside, not the wrapper.
  if (type.includes("json") || buffer.subarray(0, 1).toString() === "{") {
    try {
      const data = JSON.parse(buffer.toString("utf-8"));
      if (data && typeof data.dataString === "string") {
        const mime = String((data.imageMetadata && data.imageMetadata.mimeType) || "").toLowerCase();
        if (mime || !data.dataString.trimStart().startsWith("<")) {
          buffer = Buffer.from(data.dataString, "base64");
          type = mime.includes("jp") ? "image/jpeg" : mime.includes("webp") ? "image/webp" : "image/png";
        } else {
          buffer = Buffer.from(data.dataString, "utf-8");
          type = "text/html";
        }
      }
    } catch {
      // Not a wrapper: keep the file as it came.
    }
  }
  if (buffer.length > MAX_BYTES) fail("That file is too big to keep (over 8 MB).");
  const ext = type.includes("png")
    ? ".png"
    : type.includes("jpeg") || type.includes("jpg")
      ? ".jpg"
      : type.includes("webp")
        ? ".webp"
        : type.startsWith("image/")
          ? ".png"
          : ".html";
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name + ext);
  fs.writeFileSync(file, buffer);
  console.log(`Saved docs/03-design/stitch/${name}${ext} (${Math.round(buffer.length / 1024)} KB). Read it with the Read tool.`);
}

main().catch(() => fail("Couldn't save that file."));
