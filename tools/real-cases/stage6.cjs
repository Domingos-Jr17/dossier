// Stage 6: the recommendations, on the real sites with the real AI.
// Several sources at once (emprego.co.mz, Kukwira, CONTACT), score reasons in
// Portuguese, a letter that leaves gaps out, degrees and years in a field in
// the match, "Apply on …" for a site posting, the agent on several sources,
// and the interface in Portuguese.
const fs = require("node:fs");
const path = require("node:path");
const { open, step, shot } = require("./rc.cjs");

const FILE = path.join(__dirname, "stage6.json");
// Earlier steps' findings stay: each run adds to them.
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
const save = () => fs.writeFileSync(FILE, JSON.stringify(out, null, 1));
const TITLE = new RegExp(process.env.TITLE ?? "Contabil|Financ|Auditor|Tesour", "i");
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const run = (id) => !ONLY || ONLY.has(id);

(async () => {
  const { browser, context, page } = await open();

  if (run("1"))
    await step("6.1-multi-settings", "Settings: Several sources, emprego.co.mz + Kukwira + CONTACT, test connection", page, async () => {
      await page.goto("/settings?section=jobs");
      await page.getByRole("radio", { name: "Several sources" }).click();
      const group = page.getByRole("group", { name: "Sources to search" });
      await group.waitFor();
      const checked = {};
      for (const name of ["emprego.co.mz", "Kukwira", "CONTACT"]) checked[name] = await group.getByLabel(name).isChecked();
      await page.getByRole("button", { name: "Test connection" }).click();
      const result = page.getByText(/^Connected · Several sources answered in/).first();
      await result.waitFor({ timeout: 90_000 }).catch(() => {});
      out.multiTest = (await result.count()) ? await result.innerText() : (await page.getByRole("alert").allInnerTexts()).join(" ") || "no answer";
      out.multiChecked = checked;
      save();
      if (!/^Connected/.test(out.multiTest)) throw new Error(out.multiTest);
      return `${out.multiTest} · checked ${JSON.stringify(checked)}`;
    });

  if (run("2"))
    await step("6.2-multi-search", "Find jobs on several sources at once, no keywords, Mozambique", page, async () => {
      await page.goto("/jobs?country=mz");
      const form = page.getByRole("search", { name: "Search postings" });
      await form.getByLabel("What").fill("");
      await form.getByLabel("Where").fill("");
      await form.getByRole("button", { name: "Search" }).click();
      const list = page.getByRole("list", { name: "Postings" });
      // The last search shows until the new one is in: wait for its summary.
      await page.getByText(/postings? from Several sources · searched/).first().waitFor({ timeout: 120_000 });
      await page.waitForTimeout(1500);
      const items = await list.getByRole("listitem").allInnerTexts();
      const count = (label) => items.filter((text) => text.includes(label)).length;
      out.multi = {
        total: items.length,
        emprego: count("emprego.co.mz"),
        kukwira: count("Kukwira"),
        contact: count("CONTACT"),
        summary: await page.getByText(/postings? from Several sources · searched/).first().innerText().catch(() => ""),
        first: items.slice(0, 8).map((text) => text.replace(/\s+/g, " ").slice(0, 120)),
      };
      save();
      if (out.multi.total === 0) throw new Error("no postings");
      return `${out.multi.total} postings: emprego.co.mz ${out.multi.emprego}, Kukwira ${out.multi.kukwira}, CONTACT ${out.multi.contact} · ${out.multi.summary}`;
    });

  if (run("3"))
    await step("6.3-contact-live", "A CONTACT posting from the real site, with its whole text", page, async () => {
      const list = page.getByRole("list", { name: "Postings" });
      const item = list.getByRole("listitem").filter({ hasText: "CONTACT" }).first();
      if (!(await item.count())) {
        out.contact = { none: true };
        save();
        return "CONTACT has no open offer right now (its list holds only the spontaneous application); nothing to open";
      }
      const title = (await item.innerText()).split("\n")[0].trim();
      await item.getByRole("button").first().click();
      const text = page.getByRole("region", { name: "Posting text" });
      await text.waitFor({ timeout: 60_000 });
      await page.waitForTimeout(2000);
      const full = await text.innerText();
      out.contact = { title, length: full.length, text: full.slice(0, 1500) };
      save();
      if (full.length < 100) throw new Error(`only ${full.length} characters`);
      return `${title}: ${full.length} characters of text`;
    });

  if (run("4"))
    await step("6.4-score-language", "Score an emprego.co.mz posting: reasons in European Portuguese", page, async () => {
      const list = page.getByRole("list", { name: "Postings" });
      const item = list.getByRole("listitem").filter({ hasText: "emprego.co.mz" }).filter({ hasText: TITLE }).first();
      const target = (await item.count()) ? item : list.getByRole("listitem").filter({ hasText: "emprego.co.mz" }).first();
      const title = (await target.innerText()).split("\n")[0].trim();
      await target.getByRole("button").first().click();
      await page.getByRole("button", { name: /^Score( again)?$/ }).first().click();
      const verdict = page.getByText(/ · \d+ of 100$/).first();
      await verdict.waitFor({ timeout: 180_000 });
      const why = (await page.getByRole("list", { name: "Why it fits" }).allInnerTexts().catch(() => [])).join(" ").replace(/\s+/g, " ");
      out.score = { title, verdict: await verdict.innerText(), why };
      save();
      const english = (why.match(/\b(the|your|with|and|experience|role)\b/gi) ?? []).length;
      if (english > 2) throw new Error(`reasons look English: ${why.slice(0, 200)}`);
      return `${title} → ${out.score.verdict} | ${why.slice(0, 260)}`;
    });

  if (run("5"))
    await step("6.5-gaps-setting", "Settings: cover letters leave gaps out", page, async () => {
      await page.goto("/settings?section=documents");
      await page.getByLabel("Gaps in the cover letter").selectOption("leave-out");
      await page.waitForTimeout(1500);
      await page.reload();
      const value = await page.getByLabel("Gaps in the cover letter").inputValue();
      if (value !== "leave-out") throw new Error(`setting is ${value}`);
      return "Leave them out";
    });

  if (run("6"))
    await step("6.6-match", "Start an application from a real posting: degrees and years in the field", page, async () => {
      await page.goto("/jobs?country=mz");
      const form = page.getByRole("search", { name: "Search postings" });
      await form.getByRole("button", { name: "Search" }).click();
      const list = page.getByRole("list", { name: "Postings" });
      await list.waitFor({ timeout: 120_000 });
      const item = list.getByRole("listitem").filter({ hasText: "emprego.co.mz" }).filter({ hasText: TITLE }).first();
      out.title = (await item.innerText()).split("\n")[0].trim();
      await item.getByRole("button").first().click();
      await page.getByRole("button", { name: "Start application →" }).click();
      await page.waitForURL(/\/new/, { timeout: 60_000 });
      await page.getByRole("button", { name: "Read the posting →" }).click();
      await page.getByRole("heading", { name: "How you match" }).waitFor({ timeout: 240_000 });
      out.match = await page.locator("main").innerText();
      save();
      const degree = /Licenciatura|Mestrado|Bacharel|Universidade/i.test(out.match.split("How you match")[1] ?? "");
      const years = /role(s)? in this field, since|No role in your profile in this field/.test(out.match);
      const leaves = /the letter leaves it out/.test(out.match);
      out.matchChecks = { degree, years, leaves };
      save();
      return `${out.title} · degree named: ${degree} · years in field: ${years} · "the letter leaves it out": ${leaves}`;
    });

  if (run("7"))
    await step("6.7-write", "Create it: resume and a letter that leaves gaps out", page, async () => {
      await page.getByRole("button", { name: "Create application →" }).click();
      await page.waitForURL(/\/applications\/c/, { timeout: 600_000 });
      out.application = page.url();
      await page.getByRole("article", { name: "Resume" }).waitFor({ timeout: 600_000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Writing"), null, { timeout: 600_000 }).catch(() => {});
      await page.getByRole("tab", { name: "Cover letter" }).click();
      const letter = page.getByRole("article", { name: "Cover letter" });
      await letter.waitFor({ timeout: 600_000 });
      out.letter = await letter.innerText();
      const flags = [];
      for (const tab of ["Resume", "Cover letter"]) {
        await page.getByRole("tab", { name: tab }).click();
        for (const flag of await page.getByRole("button", { name: /^Check this: / }).all()) flags.push(`${tab}: ${(await flag.getAttribute("aria-label")).replace(/^Check this: /, "")}`);
      }
      out.flags = flags;
      out.gapWords = (out.letter.match(/\b(embora (?:não|ainda)|apesar de não|não tenho|ainda não tenho|estou a (?:concluir|terminar|frequentar)|pretendo|vou (?:obter|concluir))\b/gi) ?? []);
      save();
      return `letter ${out.letter.length} chars · gap or plan phrases: ${out.gapWords.join(", ") || "none"} · flagged: ${flags.length}${flags.length ? " (" + flags.join(" / ").slice(0, 200) + ")" : ""}`;
    });

  if (run("8"))
    await step("6.8-apply-on-site", "Email tab: apply on the site, with steps and attachments", page, async () => {
      if (out.application) await page.goto(out.application);
      else await page.goto("/applications");
      await page.getByRole("tab", { name: "Email" }).click();
      const card = page.locator('section[aria-labelledby="apply-on-site"]');
      await card.waitFor({ timeout: 30_000 });
      out.applyOnSite = (await card.innerText()).replace(/\s+/g, " ").slice(0, 600);
      save();
      return out.applyOnSite.slice(0, 300);
    });

  if (run("9"))
    await step("6.9-agent", "The agent on several sources, run by hand", page, async () => {
      await page.goto("/agent");
      const started = Date.now();
      await page.getByRole("button", { name: "Run now" }).click();
      await page.getByRole("button", { name: "Running…" }).waitFor({ timeout: 30_000 }).catch(() => {});
      await page.getByRole("button", { name: "Run now" }).waitFor({ timeout: 900_000 });
      out.agentSeconds = Math.round((Date.now() - started) / 1000);
      await page.waitForTimeout(2000);
      await page.reload();
      out.agent = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1500);
      save();
      return out.agent.slice(0, 400);
    });

  if (run("10")) {
    await context.addCookies([{ name: "dossier_language", value: "pt-PT", url: "http://127.0.0.1:3200" }]);
    for (const [id, url] of [
      ["dashboard", "/"],
      ["jobs", "/jobs?country=mz"],
      ["agent", "/agent"],
      ["application", out.application ?? "/applications"],
    ]) {
      await step(`6.10-pt-${id}`, `Interface in Portuguese: ${url.replace(/\/applications\/c\w+/, "/applications/…")}`, page, async () => {
        await page.goto(url);
        await page.waitForTimeout(2500);
        const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
        out[`pt-${id}`] = text.slice(0, 800);
        save();
        return text.slice(0, 220);
      });
    }
    await context.clearCookies({ name: "dossier_language" });
  }

  await shot(page, "6-end");
  await browser.close();
})();
