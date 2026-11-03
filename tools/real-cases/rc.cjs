// Real-case run helpers: a signed-in browser on the real-case app, screenshots,
// and a results log (one JSON line per step) for the report.
const fs = require("node:fs");
const path = require("node:path");
const REPO = path.resolve(__dirname, "../..");
const { chromium } = require(path.join(REPO, "node_modules/playwright"));

const DIR = __dirname;
const BASE = "http://127.0.0.1:3200";
const STATE = path.join(DIR, "state.json");
const SHOTS = path.join(DIR, "shots");
const LOG = path.join(DIR, "results.jsonl");
fs.mkdirSync(SHOTS, { recursive: true });

async function open() {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    ...(fs.existsSync(STATE) ? { storageState: STATE } : {}),
  });
  context.setDefaultTimeout(30_000);
  const page = await context.newPage();
  await page.goto("/");
  if (page.url().includes("/login")) {
    await page.getByLabel("Password", { exact: true }).fill("e2e-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    await context.storageState({ path: STATE });
  }
  return { browser, context, page };
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** Runs one step, timing it and logging pass/fail with notes; never throws, so later steps still run. */
async function step(id, title, page, work) {
  const started = Date.now();
  let status = "pass";
  let notes = "";
  try {
    notes = (await work()) ?? "";
  } catch (error) {
    status = "fail";
    notes = String(error?.message ?? error).split("\n").slice(0, 6).join(" | ");
  }
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  let screenshot = null;
  try {
    screenshot = await shot(page, id);
  } catch {}
  const entry = { id, title, status, seconds, notes, screenshot, at: new Date().toISOString() };
  fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
  console.log(`${status === "pass" ? "PASS" : "FAIL"} ${id} ${title} (${seconds}s) ${notes}`);
  return entry;
}

module.exports = { open, shot, step, BASE, DIR };
