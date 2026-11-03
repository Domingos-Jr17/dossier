// Stage 3: a whole application from a real emprego.co.mz posting, with the real AI:
// match, tailored resume and letter in European Portuguese, fact guard, refine,
// PDF, email and status. TITLE picks the posting (a regex), SOURCE_Q the search.
const fs = require("node:fs");
const path = require("node:path");
const { open, step } = require("./rc.cjs");

const PREFIX = process.env.PREFIX ?? "3";
const QUERY = process.env.SOURCE_Q ?? "financeiro";
const TITLE = new RegExp(process.env.TITLE ?? "Financ", "i");
const out = { query: QUERY };
const save = () => fs.writeFileSync(path.join(__dirname, `stage${PREFIX}.json`), JSON.stringify(out, null, 1));

// Words that give Brazilian Portuguese away, and ones that say European.
const BRAZIL = /\b(contato|equipe|você|vocês|gerenciamento|gerenciar|registro|time de|planejamento|atual(?:mente)? na|fato|aprimorar|treinamento)\b/gi;
const EUROPE = /\b(contacto|equipa|gestão|registo|planeamento|actual|facto|formação|Exmos?\.)\b/gi;
const words = (text, pattern) => [...new Set((text.match(pattern) ?? []).map((w) => w.toLowerCase()))];

(async () => {
  const { browser, page } = await open();

  await step(`${PREFIX}.1-start`, `Start an application from a real posting (${QUERY})`, page, async () => {
    await page.goto(`/jobs?q=${encodeURIComponent(QUERY)}&where=&country=mz`);
    await page.getByRole("search", { name: "Search postings" }).getByRole("button", { name: "Search" }).click();
    const list = page.getByRole("list", { name: "Postings" });
    await list.waitFor({ timeout: 60_000 });
    const item = list.getByRole("listitem").filter({ hasText: TITLE }).first();
    out.title = (await item.innerText()).split("\n")[0].trim();
    await item.getByRole("button").first().click();
    await page.getByRole("button", { name: "Start application →" }).click();
    await page.waitForURL(/\/new/, { timeout: 60_000 });
    out.posting = await page.getByLabel("Job posting").inputValue();
    out.link = await page.getByLabel(/^Link to the posting/).inputValue();
    save();
    return `${out.title}: ${out.posting.length} chars of posting; link ${out.link}`;
  });

  await step(`${PREFIX}.2-match`, "Read the posting: details, requirements and gaps", page, async () => {
    await page.getByRole("button", { name: "Read the posting →" }).click();
    await page.getByRole("heading", { name: "How you match" }).waitFor({ timeout: 240_000 });
    out.company = await page.getByLabel("Company").inputValue();
    out.role = await page.getByLabel("Role").inputValue();
    out.match = await page.locator("main").innerText();
    save();
    return `company "${out.company}", role "${out.role}"`;
  });

  await step(`${PREFIX}.3-write`, "Create the application: tailored resume and cover letter", page, async () => {
    await page.getByRole("button", { name: "Create application →" }).click();
    await page.waitForURL(/\/applications\/c/, { timeout: 600_000 });
    out.application = page.url();
    const resume = page.getByRole("article", { name: "Resume" });
    await resume.waitFor({ timeout: 600_000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Writing"), null, { timeout: 600_000 }).catch(() => {});
    out.resume = await resume.innerText();
    await page.getByRole("tab", { name: "Cover letter" }).click();
    const letter = page.getByRole("article", { name: "Cover letter" });
    await letter.waitFor({ timeout: 600_000 });
    out.letter = await letter.innerText();
    save();
    return `resume ${out.resume.length} chars, letter ${out.letter.length} chars`;
  });

  await step(`${PREFIX}.4-language`, "Documents in European Portuguese, not Brazilian", page, async () => {
    const all = `${out.resume}\n${out.letter}`;
    const brazil = words(all, BRAZIL);
    const europe = words(all, EUROPE);
    out.language = { brazil, europe };
    save();
    if (brazil.length) throw new Error(`Brazilian words: ${brazil.join(", ")} (European: ${europe.join(", ")})`);
    return `European markers: ${europe.join(", ") || "none"}; Brazilian: none`;
  });

  await step(`${PREFIX}.5-facts`, "Fact guard: what the documents say that the profile doesn't", page, async () => {
    const flags = [];
    for (const tab of ["Resume", "Cover letter"]) {
      await page.getByRole("tab", { name: tab }).click();
      for (const flag of await page.getByRole("button", { name: /^Check this: / }).all()) flags.push(`${tab}: ${(await flag.getAttribute("aria-label")).replace(/^Check this: /, "")}`);
    }
    out.flags = flags;
    // Facts the fictional CV doesn't have, to look for by hand too.
    const all = `${out.resume}\n${out.letter}`;
    out.suspicious = (all.match(/\b(ACCA|CPA|CIMA|MBA|mestrado|\d{2,}\s?%|\d+ anos de experiência)\b/gi) ?? []).filter((w, i, a) => a.indexOf(w) === i);
    save();
    return `${flags.length} flagged${flags.length ? ": " + flags.join(" / ").slice(0, 400) : ""}; numbers/titles to check by hand: ${out.suspicious.join(", ") || "none"}`;
  });

  await step(`${PREFIX}.6-refine`, "Refine in the chat: a shorter summary that leads with trade finance", page, async () => {
    await page.getByRole("tab", { name: "Resume" }).click();
    const box = page.getByRole("textbox", { name: "Ask for a change" });
    await box.fill("Torna o resumo mais curto e começa pela experiência em trade finance e cash management.");
    await box.press("Enter");
    const log = page.getByRole("log", { name: "Conversation" });
    await log.getByRole("button", { name: "Undo" }).first().waitFor({ timeout: 240_000 });
    out.refined = await page.getByRole("article", { name: "Resume" }).innerText();
    out.chat1 = await log.innerText();
    save();
    return out.chat1.split("\n").slice(-3).join(" ").slice(0, 300);
  });

  await step(`${PREFIX}.7-invent`, "Refine asking for a fact that isn't in the profile (ACCA)", page, async () => {
    const box = page.getByRole("textbox", { name: "Ask for a change" });
    const before = await page.getByRole("log", { name: "Conversation" }).innerText();
    await box.fill("Acrescenta que tenho a certificação ACCA.");
    await box.press("Enter");
    await page.waitForFunction((previous) => {
      const log = document.querySelector('[role="log"]');
      return log && log.textContent.length > previous + 40 && !/Thinking|Writing|…$/.test(log.textContent.slice(-20));
    }, before.length, { timeout: 240_000 });
    await page.waitForTimeout(3000);
    const after = await page.getByRole("log", { name: "Conversation" }).innerText();
    out.chat2 = after.slice(before.length);
    const resume = await page.getByRole("article", { name: "Resume" }).innerText();
    out.accaInResume = /ACCA/.test(resume);
    save();
    if (out.accaInResume) throw new Error(`ACCA was added to the resume. Chat: ${out.chat2.slice(0, 300)}`);
    return `not added. Chat: ${out.chat2.replace(/\s+/g, " ").slice(0, 300)}`;
  });

  await step(`${PREFIX}.8-pdf`, "Download the tailored resume as PDF", page, async () => {
    await page.getByRole("tab", { name: "Resume" }).click();
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.getByRole("link", { name: "Download PDF" }).click()]);
    const file = path.join(__dirname, `${PREFIX}-${download.suggestedFilename()}`);
    await download.saveAs(file);
    const size = fs.statSync(file).size;
    out.pdf = file;
    save();
    if (size < 5000) throw new Error(`only ${size} bytes`);
    return `${download.suggestedFilename()} (${Math.round(size / 1024)} KB)`;
  });

  await step(`${PREFIX}.9-email`, "Write the application email: who it goes to", page, async () => {
    await page.getByRole("tab", { name: "Email" }).click();
    const write = page.getByRole("button", { name: "Write the email" });
    if (await write.count()) await write.click();
    const email = page.getByRole("article", { name: "Email" });
    await email.getByRole("group", { name: "Message" }).waitFor({ timeout: 240_000 });
    await page.waitForTimeout(2000);
    out.email = {
      to: await email.getByRole("group", { name: "Recipient" }).innerText(),
      subject: await email.getByRole("group", { name: "Subject" }).innerText(),
      body: await email.getByRole("group", { name: "Message" }).innerText(),
    };
    save();
    return `to: "${out.email.to.replace(/\s+/g, " ").trim()}" · subject: "${out.email.subject.replace(/\s+/g, " ").trim()}"`;
  });

  await step(`${PREFIX}.10-status`, "Move the application to Sent in the table", page, async () => {
    await page.goto("/applications?view=table");
    const select = page.getByLabel(/^Status of /).first();
    await select.selectOption("SENT");
    await page.waitForTimeout(1500);
    await page.reload();
    const value = await page.getByLabel(/^Status of /).first().inputValue();
    if (value !== "SENT") throw new Error(`status is ${value}`);
    return `status ${value}`;
  });

  await browser.close();
})();
