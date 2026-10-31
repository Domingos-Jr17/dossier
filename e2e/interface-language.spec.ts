import { expect, test } from "@playwright/test";

// The interface in European Portuguese (this fork): the sidebar's button
// switches it, the screens follow as they change, and what the user wrote
// stays as written.

test("switches the interface to Portuguese and back", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "Find jobs" })).toBeVisible();

  await page.getByRole("button", { name: "Português" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Procurar vagas" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await expect(page.getByRole("link", { name: "Definições" })).toBeVisible();

  // A screen opened next is in Portuguese too, typed text included as typed.
  await page.getByRole("link", { name: "Candidaturas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Candidaturas" })).toBeVisible();
  const search = page.getByPlaceholder("Pesquisar empresa ou cargo");
  await search.fill("Settings");
  await expect(search).toHaveValue("Settings");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
