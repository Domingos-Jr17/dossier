// Stages 5–7: a pasted link, the job agent on the real source, and error cases.
const fs = require("node:fs");
const path = require("node:path");
const { open, step } = require("./rc.cjs");

const LINK = process.env.LINK;
const out = {};
const save = () => fs.writeFileSync(path.join(__dirname, "stage5.json"), JSON.stringify(out, null, 1));

async function chooseSource(page, name) {
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name }).click();
  await page.waitForTimeout(1500);
}

(async () => {
  const { browser, page } = await open();

  await step("5.1-link", "New application from a pasted emprego.co.mz link (Fetch)", page, async () => {
    await page.goto("/new?fresh=1");
    await page.getByLabel(/^Link to the posting/).fill(LINK);
    await page.getByRole("button", { name: "Fetch" }).click();
    await page.waitForFunction(() => (document.querySelector("textarea")?.value ?? "").length > 50 || /Paste the posting/.test(document.body.innerText), null, { timeout: 60_000 });
    const text = await page.getByLabel("Job posting").inputValue();
    out.fetched = text;
    save();
    const noise = ["Perguntas frequentes", "Subscrever", "Aceder a tua conta", "Criar conta", "Candidatura Recusada"].filter((w) => text.includes(w));
    if (!text) throw new Error(await page.getByText(/Paste the posting/).first().innerText());
    return `${text.length} chars; starts "${text.slice(0, 140).replace(/\s+/g, " ")}"${noise.length ? `; page noise in it: ${noise.join(", ")}` : "; no page noise"}`;
  });

  await step("6.1-agent-setup", "Job agent: financeiro, Mozambique, on emprego.co.mz", page, async () => {
    await chooseSource(page, "emprego.co.mz");
    await page.goto("/settings?section=agent");
    await page.getByLabel("What").fill("financeiro");
    await page.getByLabel("Country").selectOption("mz");
    const toggle = page.getByRole("switch", { name: "Run the job agent" });
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
    await page.waitForTimeout(1500);
    return `on: ${await toggle.getAttribute("aria-checked")}`;
  });

  await step("6.2-agent-run", "Job agent run: search, whole texts, scores (real AI)", page, async () => {
    await page.goto("/agent");
    await page.getByRole("button", { name: "Run now" }).click();
    await page.waitForFunction(() => /waiting for a look|none reached|No new postings|found no postings|couldn't|could not/i.test(document.body.innerText), null, { timeout: 600_000 });
    await page.waitForTimeout(2000);
    await page.reload();
    const body = await page.locator("main").innerText();
    out.agent = body;
    const cards = await page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).allInnerTexts();
    out.agentCards = cards;
    save();
    return `${(body.match(/[^\n]*(waiting for a look|none reached|No new postings|found no postings)[^\n]*/i) ?? [""])[0]} · ${cards.length} cards: ${cards.map((c) => c.split("\n").slice(0, 2).join(" ")).join(" ‖ ").slice(0, 500)}`;
  });

  await step("7.1-other-country", "Search with a country emprego.co.mz doesn't cover", page, async () => {
    await page.goto("/jobs?q=financeiro&where=&country=pt");
    await page.getByRole("search", { name: "Search postings" }).getByRole("button", { name: "Search" }).click();
    const alert = page.getByRole("alert").filter({ hasText: /doesn't list jobs/ });
    await alert.waitFor({ timeout: 15_000 });
    return await alert.innerText();
  });

  await step("7.2-no-city-page", "A place emprego.co.mz has no city page for", page, async () => {
    await page.goto("/jobs?q=&where=Cidade%20Inexistente&country=mz");
    await page.getByRole("search", { name: "Search postings" }).getByRole("button", { name: "Search" }).click();
    const nothing = page.getByText(/^No postings/);
    await nothing.waitFor({ timeout: 60_000 });
    return await nothing.innerText();
  });

  await step("7.3-jsearch-no-key", "JSearch (LinkedIn through Google) without a key", page, async () => {
    await chooseSource(page, "JSearch");
    await page.goto("/jobs?q=financeiro&where=Maputo&country=mz");
    await page.getByRole("search", { name: "Search postings" }).getByRole("button", { name: "Search" }).click();
    const message = page.getByText(/key/i).first();
    await message.waitFor({ timeout: 30_000 });
    return await message.innerText();
  });

  await step("7.4-kukwira-back", "Back to emprego.co.mz", page, async () => {
    await chooseSource(page, "emprego.co.mz");
    return "ok";
  });

  await browser.close();
})();
