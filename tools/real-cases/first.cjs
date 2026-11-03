const { open, step } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await step("2.0b-first-visit", "First visit with emprego.co.mz: the profile's place, no job title", page, async () => {
    await page.goto("/jobs");
    const form = page.getByRole("search", { name: "Search postings" });
    const values = { what: await form.getByLabel("What").inputValue(), where: await form.getByLabel("Where").inputValue(), country: await form.getByLabel("Country").inputValue() };
    if (values.what !== "" || values.where !== "Maputo" || values.country !== "mz") throw new Error(JSON.stringify(values));
    const before = page.url();
    await form.getByRole("button", { name: "Search" }).click();
    await page.waitForURL((url) => url.href !== before && url.searchParams.has("search"), { timeout: 60_000 });
    const count = await page.getByRole("list", { name: "Postings" }).getByRole("listitem").count();
    return `${JSON.stringify(values)} → ${count} postings straight away`;
  });
  await browser.close();
})();
