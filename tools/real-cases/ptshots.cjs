// Screenshots of the interface in Portuguese, for the report.
const { open } = require("./rc.cjs");
(async () => {
  const { browser, context, page } = await open();
  await context.addCookies([{ name: "dossier_language", value: "pt-PT", url: "http://127.0.0.1:3200" }]);
  const app = "/applications/cmvwgs7410007a77dmcbdp1z3";
  await page.goto(app);
  await page.getByRole("tab", { name: /^Vaga/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${__dirname}/shots/pt-posting.png` });
  console.log((await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 900));
  await page.goto("/jobs?country=mz");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${__dirname}/shots/pt-jobs.png` });
  console.log("JOBS:", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300));
  await browser.close();
})();
