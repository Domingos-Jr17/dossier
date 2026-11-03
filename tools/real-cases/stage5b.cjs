const fs = require("node:fs");
const { open, step } = require("./rc.cjs");
const LINK = process.env.LINK;
(async () => {
  const { browser, page } = await open();
  await step("5.1-link", "New application from a pasted emprego.co.mz link (Fetch)", page, async () => {
    await page.goto("/new?fresh=1");
    await page.getByLabel(/^Link to the posting/).fill(LINK);
    await page.getByRole("button", { name: "Fetch" }).click();
    await page.getByRole("button", { name: "Fetch", exact: true }).waitFor({ timeout: 60_000 });
    const text = await page.getByLabel("Job posting").inputValue();
    fs.writeFileSync(__dirname + "/fetched.txt", text);
    if (!text) throw new Error(await page.locator("main").innerText());
    const noise = ["Perguntas frequentes", "Subscrever", "Aceder a tua conta", "Criar conta", "Candidatura Recusada", "Voltar atrás", "Pesquise"].filter((w) => text.includes(w));
    return `${text.length} chars; starts "${text.slice(0, 160).replace(/\s+/g, " ")}"${noise.length ? `; site text mixed in: ${noise.join(", ")}` : "; no site text mixed in"}`;
  });
  if (process.env.SKIP72) { await browser.close(); return; }
  await step("7.2-no-city-page", "A place emprego.co.mz has no city page for (no keywords)", page, async () => {
    await page.goto("/jobs?country=mz");
    const form = page.getByRole("search", { name: "Search postings" });
    await form.getByLabel("What").fill("");
    await form.getByLabel("Where").fill("Cidade Inexistente");
    const before = page.url();
    await form.getByRole("button", { name: "Search" }).click();
    await page.waitForURL((url) => url.href !== before && url.searchParams.has("search"), { timeout: 60_000 });
    const nothing = page.getByText(/^No (open )?postings/);
    await nothing.waitFor({ timeout: 30_000 });
    return await nothing.innerText();
  });
  await browser.close();
})();
