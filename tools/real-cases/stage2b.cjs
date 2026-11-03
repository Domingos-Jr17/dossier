const fs = require("node:fs");
const { open, step } = require("./rc.cjs");
(async () => {
  const { browser, page } = await open();
  const out = {};
  for (const [id, title, q, where] of [["2.1-maputo", "Maputo, no keywords (city page)", "", "Maputo"], ["2.2-front", "No keywords, no place (front page)", "", ""]]) {
    await step(id, title, page, async () => {
      await page.goto("/jobs?country=mz");
      const form = page.getByRole("search", { name: "Search postings" });
      await form.getByLabel("What").fill(q);
      await form.getByLabel("Where").fill(where);
      await form.getByLabel("Country").selectOption("mz");
      const before = page.url();
      await form.getByRole("button", { name: "Search" }).click();
      await page.waitForURL((url) => url.href !== before && url.searchParams.has("search"), { timeout: 60_000 });
      await form.getByRole("button", { name: "Search", exact: true }).waitFor({ timeout: 60_000 });
      const list = page.getByRole("list", { name: "Postings" });
      const nothing = page.getByText(/^No postings/);
      const problem = page.getByRole("alert");
      await Promise.race([list.waitFor({ timeout: 60_000 }), nothing.waitFor({ timeout: 60_000 }), problem.first().waitFor({ timeout: 60_000 })]);
      if (await nothing.count()) return `0: ${await nothing.first().innerText()}`;
      if (!(await list.count())) throw new Error(await problem.first().innerText());
      await page.waitForTimeout(500);
      const titles = (await list.getByRole("listitem").allInnerTexts()).map((t) => t.split("\n").slice(0, 2).join(" · "));
      out[id] = titles;
      const more = await page.getByRole("button", { name: "Show more" }).count();
      return `${titles.length} postings${more ? " (+ Show more)" : ""}: ${titles.slice(0, 6).join(" ‖ ")}`;
    });
  }
  fs.writeFileSync(__dirname + "/stage2b.json", JSON.stringify(out, null, 1));
  await browser.close();
})();
