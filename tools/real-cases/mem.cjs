const { open } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  await page.goto("/applications/cmvvjccig00076i7d3b106bq5");
  await page.waitForTimeout(1500);
  const peak = require("node:child_process");
  const sample = () => +peak.execSync("ps -eo rss,args | grep -E 'server.js|chrom' | grep -v grep | grep -v 'pw/' | awk '{s+=$1} END{print int(s/1024)}'").toString();
  let max = 0; const t = setInterval(() => { max = Math.max(max, sample()); }, 150);
  const r = await page.request.get("/api/pdf?doc=resume&application=cmvvjccig00076i7d3b106bq5");
  clearInterval(t);
  console.log("pdf status", r.status(), "pico durante o PDF:", max, "MB");
  await browser.close();
})();
