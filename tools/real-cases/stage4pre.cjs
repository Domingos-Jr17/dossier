const { open, step } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await step("4.0-kukwira", "Kukwira chosen, connection test against the real site (missing certificate added)", page, async () => {
    await page.goto("/settings?section=jobs");
    await page.getByRole("radio", { name: "Kukwira" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Test connection" }).click();
    await page.waitForFunction(() => !/Sending a small search/.test(document.body.innerText), null, { timeout: 60_000 });
    const text = await page.getByText(/^Connected ·|couldn't|can't|didn't|failed|isn't/i).first().innerText();
    if (!/^Connected/.test(text)) throw new Error(text);
    return text;
  });
  await step("4.0b-browse", "Kukwira without keywords: every current opening", page, async () => {
    await page.goto("/jobs?country=mz");
    const form = page.getByRole("search", { name: "Search postings" });
    await form.getByLabel("What").fill("");
    await form.getByLabel("Where").fill("");
    const before = page.url();
    await form.getByRole("button", { name: "Search" }).click();
    await page.waitForURL((url) => url.href !== before && url.searchParams.has("search"), { timeout: 60_000 });
    const items = await page.getByRole("list", { name: "Postings" }).getByRole("listitem").allInnerTexts();
    return `${items.length}: ${items.map((t) => t.split("\n")[0]).join(" ‖ ")}`;
  });
  await browser.close();
})();
