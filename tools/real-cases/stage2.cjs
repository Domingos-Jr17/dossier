// Stage 2: Find jobs on the real emprego.co.mz, and scores from the real AI.
const fs = require("node:fs");
const path = require("node:path");
const { open, step } = require("./rc.cjs");

const out = {};

async function search(page, { q = "", where = "", country = "mz" }) {
  await page.goto(`/jobs?q=${encodeURIComponent(q)}&where=${encodeURIComponent(where)}&country=${country}`);
  const form = page.getByRole("search", { name: "Search postings" });
  // An empty "What" in the address is filled from the profile; say it here.
  await form.getByLabel("What").fill(q);
  await form.getByLabel("Where").fill(where);
  await form.getByRole("button", { name: "Search" }).click();
  const list = page.getByRole("list", { name: "Postings" });
  const nothing = page.getByText(/^No postings/);
  await Promise.race([list.waitFor({ timeout: 60_000 }), nothing.waitFor({ timeout: 60_000 })]);
  if (await nothing.count()) return { titles: [], message: await nothing.first().innerText() };
  await page.waitForTimeout(500);
  const titles = (await list.getByRole("listitem").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  return { titles };
}

(async () => {
  const { browser, page } = await open();

  for (const [id, title, query] of [
    ["2.1-maputo", "Maputo, no keywords (city page)", { where: "Maputo" }],
    ["2.2-front", "No keywords, no place (front page)", {}],
  ].filter(([id]) => !process.env.ONLY || process.env.ONLY.split(",").includes(id))) {
    await step(id, title, page, async () => {
      const result = await search(page, query);
      out[id] = result;
      return `${result.titles.length} postings${result.message ? ` (${result.message})` : ""}: ${result.titles.slice(0, 8).join(" ‖ ").slice(0, 600)}`;
    });
  }

  await step("2.6-text", "A finance posting's whole text from its own page", page, async () => {
    await search(page, { q: "financeiro" });
    const text = page.getByRole("region", { name: "Posting text" });
    await page.waitForFunction(() => (document.querySelector('[aria-label="Posting text"]')?.textContent ?? "").length > 400, null, { timeout: 60_000 });
    const body = await text.innerText();
    out.postingText = body;
    const heading = await page.getByRole("heading", { level: 2 }).first().innerText();
    return `${heading}: ${body.length} chars; starts "${body.slice(0, 160).replace(/\s+/g, " ")}"`;
  });

  const list = page.getByRole("list", { name: "Postings" });
  const items = await list.getByRole("listitem").count();
  out.scores = [];
  for (let index = 0; index < Math.min(3, items); index++) {
    await step(`2.7-score-${index + 1}`, `Score posting ${index + 1} against the profile (real AI)`, page, async () => {
      const item = list.getByRole("listitem").nth(index);
      const title = (await item.innerText()).split("\n")[0].trim();
      await item.getByRole("button").first().click();
      await page.getByRole("button", { name: /^Score( again)?$/ }).first().click();
      const verdict = page.getByText(/ · \d+ of 100$/).first();
      await verdict.waitFor({ timeout: 180_000 });
      const why = await page.getByRole("list", { name: "Why it fits" }).allInnerTexts().catch(() => []);
      const flags = await page.getByRole("list", { name: /Red flags|Watch out|Gaps/ }).allInnerTexts().catch(() => []);
      const entry = { title, verdict: await verdict.innerText(), why: why.join(" ").replace(/\s+/g, " "), flags: flags.join(" ").replace(/\s+/g, " ") };
      out.scores.push(entry);
      return `${entry.title} → ${entry.verdict} | ${entry.why.slice(0, 300)}${entry.flags ? " | flags: " + entry.flags.slice(0, 200) : ""}`;
    });
  }

  fs.writeFileSync(path.join(__dirname, "stage2.json"), JSON.stringify(out, null, 1));
  await browser.close();
})();
