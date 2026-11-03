const { open } = require("./rc.cjs");
(async () => {
  const { browser, context, page } = await open();
  await context.addCookies([{ name: "dossier_language", value: process.env.LANG_CHOICE || "pt-PT", url: "http://127.0.0.1:3200" }]);
  for (const path of (process.env.PAGES || "/agent").split(",")) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${__dirname}/shots/lang-${path.replace(/[^a-z]/g, "") || "home"}.png` });
    console.log(path, "lang=", await page.evaluate(() => document.documentElement.lang), "|", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300));
  }
  await browser.close();
})();
