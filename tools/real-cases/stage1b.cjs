const { open, step } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await step("1.3-source", "emprego.co.mz chosen, connection test against the real site", page, async () => {
    await page.goto("/settings?section=jobs");
    await page.getByRole("radio", { name: "emprego.co.mz" }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Test connection" }).click();
    await page.waitForFunction(() => !/Sending a small search/.test(document.body.innerText), null, { timeout: 60_000 });
    const text = await page.getByText(/^Connected ·|couldn't|can't|didn't|failed/i).first().innerText();
    if (!/^Connected/.test(text)) throw new Error(text);
    return text;
  });
  await browser.close();
})();
