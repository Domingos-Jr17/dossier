// Stage 1: settings (AI from the environment, European Portuguese, emprego.co.mz)
// and the profile imported from the fictional CV.
const path = require("node:path");
const { open, step } = require("./rc.cjs");

(async () => {
  const { browser, page } = await open();

  await step("1.1-ai", "AI provider from the environment (deepseek) answers", page, async () => {
    await page.goto("/settings?section=ai");
    await page.getByRole("button", { name: "Test connection" }).click();
    const answer = page.getByText(/^(Connected|Couldn't|Can't|The AI|No answer|Error)/).first();
    await answer.waitFor({ timeout: 90_000 });
    const text = await answer.innerText();
    if (!/^Connected/.test(text)) throw new Error(text);
    return text;
  });

  await step("1.2-language", "Documents in European Portuguese", page, async () => {
    await page.goto("/settings?section=documents");
    await page.getByLabel("Write documents in").selectOption({ label: "Portuguese (European)" });
    await page.waitForTimeout(1500);
    await page.reload();
    const value = await page.getByLabel("Write documents in").evaluate((select) => select.options[select.selectedIndex].text);
    if (value !== "Portuguese (European)") throw new Error(`still "${value}"`);
    return value;
  });

  await step("1.3-source", "emprego.co.mz chosen, connection test against the real site", page, async () => {
    await page.goto("/settings?section=jobs");
    await page.getByRole("radio", { name: "emprego.co.mz" }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Test connection" }).click();
    const answer = page.getByText(/^(Connected|Couldn't|Can't|emprego\.co\.mz)/).first();
    await answer.waitFor({ timeout: 60_000 });
    const text = await answer.innerText();
    if (!/^Connected/.test(text)) throw new Error(text);
    return text;
  });

  await step("1.4-import", "Profile imported from the fictional CV (PDF)", page, async () => {
    await page.goto("/profile/import");
    await page.getByLabel("Your resume, as PDF, Word (.docx) or Markdown (.md)").setInputFiles(path.join(__dirname, "cv-marta-sitoe.pdf"));
    await page.getByRole("button", { name: "Read my resume →" }).click();
    await page.getByRole("heading", { name: "Here's what your resume says" }).waitFor({ timeout: 240_000 });
    const preview = await page.locator("main").innerText();
    require("node:fs").writeFileSync(path.join(__dirname, "import-preview.txt"), preview);
    const checks = await page.locator("li", { hasText: "check" }).allInnerTexts();
    return `checks flagged: ${checks.length}${checks.length ? " → " + checks.join(" / ").replace(/\s+/g, " ").slice(0, 400) : ""}`;
  });

  await step("1.5-merge", "Imported profile saved", page, async () => {
    const merge = page.getByRole("button", { name: "Merge into my profile" });
    if (await merge.count()) await merge.click();
    else {
      await page.getByRole("button", { name: /^Replace my profile/ }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Replace my profile" }).click();
    }
    await page.waitForURL(/\/profile$/, { timeout: 60_000 });
    const name = await page.getByLabel("Full name").inputValue();
    if (name !== "Marta Sitoe") throw new Error(`name is "${name}"`);
    await page.goto("/profile?section=experience");
    return `name ${name}; experience: ${(await page.locator("button[aria-expanded]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(" / ")}`;
  });

  await browser.close();
})();
