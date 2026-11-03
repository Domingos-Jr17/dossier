const { open } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await page.goto("/agent");
  await page.waitForTimeout(1500);
  const button = page.getByRole("button", { name: "Run now" });
  console.log("button", await button.count(), await button.getAttribute("aria-disabled"));
  await button.click();
  await page.waitForTimeout(1200);
  console.log("toasts:", await page.getByRole("status").allInnerTexts());
  console.log("button now:", await page.getByRole("button", { name: /Run now|Running/ }).innerText());
  await page.screenshot({ path: __dirname + "/shots/agent-click.png" });
  await browser.close();
})();
