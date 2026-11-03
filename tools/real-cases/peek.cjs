const { open, step } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await step("2.0-defaults", "Find jobs form filled from the profile (country Moçambique)", page, async () => {
    await page.goto("/jobs");
    const form = page.getByRole("search", { name: "Search postings" });
    const values = { what: await form.getByLabel("What").inputValue(), where: await form.getByLabel("Where").inputValue(), country: await form.getByLabel("Country").inputValue() };
    if (values.country !== "mz") throw new Error(`country not recognised: ${JSON.stringify(values)}`);
    return JSON.stringify(values);
  });
  await browser.close();
})();
