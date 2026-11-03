const { open } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name: "Kukwira" }).click();
  await page.waitForTimeout(1500);
  await browser.close();
})();
