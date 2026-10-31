import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// Mozambique's job sources against the fake ones in e2e/fake-jobs.mts:
// emprego.co.mz and Kukwira have no API, so the app reads their pages, as
// served there in their own markup.
test.beforeAll(resetData);

const chosen = async (source: string) =>
  expect.poll(async () => (await sql<{ value: string }>(`SELECT value FROM "Setting" WHERE key = 'jobSource'`))[0]?.value).toContain(source);

test.afterAll(async ({ browser }) => {
  // Back to JSearch, as the environment sets it, for the tests after.
  const page = await browser.newPage({ storageState: "e2e/.auth/state.json" });
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name: "JSearch" }).click();
  await chosen("JSEARCH");
  await page.close();
});

test("searches emprego.co.mz, leaves expired postings out, and reads a posting's own page", async ({ page }) => {
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name: "emprego.co.mz" }).click();
  await expect(page.getByText(/^No key needed\. Dossier reads emprego\.co\.mz's pages as a visitor would/)).toBeVisible();
  await chosen("EMPREGO_MZ");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/^Connected · emprego\.co\.mz answered in/)).toBeVisible();

  await page.goto("/jobs?q=engenheiro&where=Maputo&country=mz");
  const form = page.getByRole("search", { name: "Search postings" });
  await expect(form.getByText("emprego.co.mz has no distance filter")).toBeVisible();
  await form.getByRole("button", { name: "Search" }).click();

  // The expired posting on the same page isn't shown.
  const list = page.getByRole("list", { name: "Postings" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Engenheiro Civil Sénior" })).toBeVisible();
  await expect(page.getByText(/^1 posting from emprego\.co\.mz · searched/)).toBeVisible();
  // The list gave only its start; the rest comes from the posting's own page.
  const text = page.getByRole("region", { name: "Posting text" });
  await expect(text).toContainText("Coordenar a fiscalização de obras de estradas e pontes");
  await expect(text).toContainText("Candidatura: https://jobs.example/construtora-baia");
  await expect(page.getByText("Vagas de emprego.co.mz").last()).toBeVisible();
});

test("says a country other than Mozambique isn't covered", async ({ page }) => {
  await page.goto("/jobs?q=engenheiro&where=Rotterdam&country=nl");
  const form = page.getByRole("search", { name: "Search postings" });
  await form.getByRole("button", { name: "Search" }).click();
  // The form says so before anything is asked.
  await expect(page.getByRole("alert").filter({ hasText: "emprego.co.mz doesn't list jobs in Netherlands." })).toBeVisible();
  await expect(form.getByLabel("Country")).toHaveAttribute("aria-invalid", "true");
});

test("searches Kukwira's openings and reads one's whole text", async ({ page }) => {
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name: "Kukwira" }).click();
  await chosen("KUKWIRA");

  await page.goto("/jobs?q=manutencao&where=&country=mz");
  await page.getByRole("search", { name: "Search postings" }).getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Técnico de Manutenção Industrial" })).toBeVisible();
  const text = page.getByRole("region", { name: "Posting text" });
  await expect(text).toContainText("Registo das intervenções no plano de manutenção");
  await expect(text).toContainText(/Candidatura: http:\/\/localhost:\d+\/kukwira\/#\/candidatura#700/);
});

test("searches emprego.co.mz and Kukwira at once, each posting keeping its source", async ({ page }) => {
  await page.goto("/settings?section=jobs");
  await page.getByRole("radio", { name: "Several sources" }).click();
  await chosen("MULTI");
  const sources = page.getByRole("group", { name: "Sources to search" });
  await expect(sources.getByLabel("emprego.co.mz")).toBeChecked();
  await expect(sources.getByLabel("Kukwira")).toBeChecked();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/^Connected · Several sources answered in/)).toBeVisible();

  await page.goto("/jobs?country=mz");
  await expect(page.getByText("Search emprego.co.mz and Kukwira for postings near you, then start an application from the one you like.")).toBeVisible();
  const form = page.getByRole("search", { name: "Search postings" });
  await form.getByLabel("What").fill("");
  await form.getByLabel("Where").fill("Maputo");
  await form.getByRole("button", { name: "Search" }).click();
  const list = page.getByRole("list", { name: "Postings" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").filter({ hasText: "Engenheiro Civil Sénior" })).toContainText("Vagas de emprego.co.mz");
  await expect(list.getByRole("listitem").filter({ hasText: "Técnico de Manutenção Industrial" })).toContainText("Vagas da Kukwira");
  await expect(page.getByText(/^2 postings from Several sources · searched/)).toBeVisible();
  // Each one's whole text comes from its own source.
  await list.getByRole("button", { name: /^Técnico de Manutenção Industrial/ }).click();
  await expect(page.getByRole("region", { name: "Posting text" })).toContainText("Registo das intervenções no plano de manutenção");
});
