const path = require("node:path");
const { chromium } = require(path.join(__dirname, "../../node_modules/playwright"));
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.goto("file://" + process.argv[2]);
  await page.pdf({ path: process.argv[3], format: "A4", printBackground: true });
  await browser.close();
})();
