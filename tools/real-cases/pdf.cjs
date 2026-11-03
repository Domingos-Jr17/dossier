const fs = require("node:fs");
const path = require("node:path");
const { open, step } = require("./rc.cjs");
const PREFIX = process.env.PREFIX ?? "3";
(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, `stage${PREFIX}.json`), "utf8"));
  const { browser, page } = await open();
  for (const tab of ["Resume", "Cover letter"]) {
    await step(`${PREFIX}.8-pdf${tab === "Resume" ? "" : "-letter"}`, `Download the tailored ${tab.toLowerCase()} as PDF`, page, async () => {
      await page.goto(data.application);
      await page.getByRole("tab", { name: tab }).click();
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.getByRole("link", { name: "Download PDF" }).click()]);
      const file = path.join(__dirname, `${PREFIX}-${tab === "Resume" ? "curriculo" : "carta"}.pdf`);
      await download.saveAs(file);
      const size = fs.statSync(file).size;
      if (size < 5000) throw new Error(`only ${size} bytes`);
      return `${download.suggestedFilename()} (${Math.round(size / 1024)} KB)`;
    });
  }
  await browser.close();
})();
