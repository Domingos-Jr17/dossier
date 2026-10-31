import { describe, expect, it, vi } from "vitest";

import { encryptSecret, JOB_SOURCE_KEY } from "@/lib/secrets";

import { arbeitsagenturStartupNotice, credentialsFor, jobSearchView, requestContext, resolveJobSearchConfig } from "./config";

vi.mock("@/lib/env", () => ({ env: { DOSSIER_SECRET: "a".repeat(32) } }));

const nothingSaved = {
  jobSource: null,
  jsearchKeyEnc: null,
  jsearchHost: "openwebninja" as const,
  adzunaAppId: null,
  adzunaKeyEnc: null,
  arbeitsagenturAcceptedAt: null,
};
const ACCEPTED = "2026-10-23T09:00:00.000Z";
const noEnv = {};

describe("resolveJobSearchConfig", () => {
  it("is off until a source is chosen", () => {
    const config = resolveJobSearchConfig(nothingSaved, noEnv);
    expect(config).toMatchObject({ source: null, saved: false, jsearch: { key: null, keyState: "none" }, adzuna: { appId: "", key: null } });
    expect(jobSearchView(config)).toEqual({
      source: "OFF",
      jsearch: { host: "openwebninja", keyState: "none" },
      adzuna: { appId: "", keyState: "none" },
      arbeitsagentur: { offered: true, acceptedAt: null },
      freehire: { host: "freehire.me" },
      multi: ["EMPREGO_MZ", "KUKWIRA", "CONTACT_MZ"],
    });
  });

  it("uses the environment until something is saved", () => {
    const config = resolveJobSearchConfig(nothingSaved, {
      DOSSIER_JOBS_SOURCE: "jsearch",
      DOSSIER_JSEARCH_KEY: "ak_env",
      DOSSIER_JSEARCH_HOST: "rapidapi",
      DOSSIER_ADZUNA_APP_ID: "app-env",
      DOSSIER_ADZUNA_KEY: "adz-env",
    });
    expect(config).toMatchObject({
      source: "JSEARCH",
      saved: false,
      jsearch: { key: "ak_env", host: "rapidapi", keyState: "env" },
      adzuna: { appId: "app-env", key: "adz-env", keyState: "env" },
    });
    expect(resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "off" }).source).toBeNull();
  });

  it("prefers what's saved, Off included, and decrypts saved keys", () => {
    const saved = {
      jobSource: "ADZUNA" as const,
      jsearchKeyEnc: encryptSecret(JOB_SOURCE_KEY, "ak_saved"),
      jsearchHost: "openwebninja" as const,
      adzunaAppId: "app-saved",
      adzunaKeyEnc: encryptSecret(JOB_SOURCE_KEY, "adz-saved"),
      arbeitsagenturAcceptedAt: null,
    };
    const config = resolveJobSearchConfig(saved, { DOSSIER_JOBS_SOURCE: "jsearch", DOSSIER_JSEARCH_KEY: "ak_env", DOSSIER_JSEARCH_HOST: "rapidapi" });
    expect(config).toMatchObject({
      source: "ADZUNA",
      saved: true,
      jsearch: { key: "ak_saved", host: "openwebninja", keyState: "set" },
      adzuna: { appId: "app-saved", key: "adz-saved", keyState: "set" },
    });
    expect(resolveJobSearchConfig({ ...saved, jobSource: "OFF" }, { DOSSIER_JOBS_SOURCE: "jsearch" })).toMatchObject({ source: null, saved: true });
  });

  it("says when a saved key can't be read, rather than using another", () => {
    const config = resolveJobSearchConfig(
      { ...nothingSaved, jobSource: "JSEARCH", jsearchKeyEnc: encryptSecret(JOB_SOURCE_KEY, "ak", "b".repeat(32)) },
      { DOSSIER_JSEARCH_KEY: "ak_env" },
    );
    expect(config.jsearch).toEqual({ key: null, host: "openwebninja", keyState: "unreadable" });
    expect(() => credentialsFor(config, "JSEARCH")).toThrow("Your saved JSearch key can't be read. Enter it again in Settings → Job search.");
  });
});

describe("credentialsFor", () => {
  const config = resolveJobSearchConfig(
    { ...nothingSaved, jobSource: "JSEARCH", jsearchKeyEnc: encryptSecret(JOB_SOURCE_KEY, "ak_saved"), jsearchHost: "rapidapi" },
    noEnv,
  );

  it("gives each source its own key", () => {
    expect(credentialsFor(config, "JSEARCH")).toEqual({ key: "ak_saved", host: "rapidapi" });
    expect(credentialsFor({ ...config, arbeitsagentur: { offered: true, acceptedAt: ACCEPTED } }, "ARBEITSAGENTUR")).toEqual({});
    expect(credentialsFor(config, "FREEHIRE")).toEqual({});
  });

  it("says what's missing", () => {
    expect(() => credentialsFor(config, "ADZUNA")).toThrow("Add your Adzuna app ID and key in Settings → Job search first.");
    expect(() => credentialsFor(resolveJobSearchConfig(nothingSaved, noEnv), "JSEARCH")).toThrow("Add your JSearch key in Settings → Job search first.");
    const keyOnly = resolveJobSearchConfig({ ...nothingSaved, adzunaKeyEnc: encryptSecret(JOB_SOURCE_KEY, "adz") }, noEnv);
    expect(() => credentialsFor(keyOnly, "ADZUNA")).toThrow(/app ID and key/);
  });
});

describe("the Bundesagentur für Arbeit (#223)", () => {
  const chosen = { ...nothingSaved, jobSource: "ARBEITSAGENTUR" as const };

  it("isn't searched until its note is accepted", () => {
    const waiting = resolveJobSearchConfig(chosen, noEnv);
    expect(waiting).toMatchObject({ source: "ARBEITSAGENTUR", arbeitsagentur: { offered: true, acceptedAt: null } });
    expect(() => credentialsFor(waiting, "ARBEITSAGENTUR")).toThrow(
      expect.objectContaining({ problem: "not-accepted", message: "Read the note about Bundesagentur für Arbeit and tick “I understand” before Dossier searches it." }),
    );
    const accepted = resolveJobSearchConfig({ ...chosen, arbeitsagenturAcceptedAt: ACCEPTED }, noEnv);
    expect(credentialsFor(accepted, "ARBEITSAGENTUR")).toEqual({});
  });

  it("is off everywhere when the server turns it off, a saved choice included", () => {
    const off = resolveJobSearchConfig({ ...chosen, arbeitsagenturAcceptedAt: ACCEPTED }, { DOSSIER_JOBS_ARBEITSAGENTUR: "off" });
    expect(off).toMatchObject({ source: null, saved: true, arbeitsagentur: { offered: false } });
    expect(jobSearchView(off)).toMatchObject({ source: "OFF", arbeitsagentur: { offered: false, acceptedAt: ACCEPTED } });
    // A saved BA posting doesn't fetch its text either.
    expect(() => credentialsFor(off, "ARBEITSAGENTUR")).toThrow(expect.objectContaining({ problem: "off" }));
    // Other sources aren't touched.
    expect(resolveJobSearchConfig({ ...chosen, jobSource: "JSEARCH" }, { DOSSIER_JOBS_ARBEITSAGENTUR: "off" }).source).toBe("JSEARCH");
  });

  it("logs its note at start when DOSSIER_JOBS_SOURCE chooses it", () => {
    const fromEnv = resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "arbeitsagentur" });
    expect(arbeitsagenturStartupNotice(fromEnv)).toMatch(
      /^Job search: DOSSIER_JOBS_SOURCE chooses the Bundesagentur für Arbeit\. The Bundesagentur für Arbeit has no official API\..* It isn't searched until you tick “I understand” in Settings → Job search\.$/,
    );
    const acceptedFromEnv = resolveJobSearchConfig({ ...nothingSaved, arbeitsagenturAcceptedAt: ACCEPTED }, { DOSSIER_JOBS_SOURCE: "arbeitsagentur" });
    expect(arbeitsagenturStartupNotice(acceptedFromEnv)).not.toMatch(/isn't searched/);
    // Chosen in Settings, or another source: nothing to log.
    expect(arbeitsagenturStartupNotice(resolveJobSearchConfig(chosen, noEnv))).toBeNull();
    expect(arbeitsagenturStartupNotice(resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "jsearch" }))).toBeNull();
  });
});

describe("requestContext", () => {
  it("leaves sources at their own address, unless the end-to-end tests point them at a fake", () => {
    expect(requestContext("JSEARCH", undefined)).toEqual({});
    expect(requestContext("ADZUNA", "http://127.0.0.1:3998/")).toEqual({ baseUrl: "http://127.0.0.1:3998/adzuna" });
    expect(requestContext("FREEHIRE", undefined, "https://jobs.example")).toEqual({ baseUrl: "https://jobs.example" });
    expect(requestContext("FREEHIRE", "http://127.0.0.1:3998/", "https://jobs.example")).toEqual({
      baseUrl: "http://127.0.0.1:3998/freehire",
    });
  });
});

describe("Several sources", () => {
  it("asks the sources chosen in Settings, else DOSSIER_JOBS_SOURCES, else Mozambique's boards and agencies", () => {
    expect(resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "multi" })).toMatchObject({ source: "MULTI", multi: ["EMPREGO_MZ", "KUKWIRA", "CONTACT_MZ"] });
    expect(resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCES: ["kukwira", "jsearch"] }).multi).toEqual(["KUKWIRA", "JSEARCH"]);
    expect(resolveJobSearchConfig({ ...nothingSaved, multiSources: ["FREEHIRE"] }, { DOSSIER_JOBS_SOURCES: ["kukwira"] }).multi).toEqual(["FREEHIRE"]);
    expect(jobSearchView(resolveJobSearchConfig({ ...nothingSaved, multiSources: ["EMPREGO_MZ"] }, noEnv)).multi).toEqual(["EMPREGO_MZ"]);
  });

  it("asks each source with its own key, leaving out one without", () => {
    const config = resolveJobSearchConfig({ ...nothingSaved, jobSource: "MULTI", multiSources: ["EMPREGO_MZ", "JSEARCH", "KUKWIRA"] }, noEnv);
    expect(credentialsFor(config, "MULTI")).toEqual({
      parts: [
        { source: "EMPREGO_MZ", credentials: {}, context: {} },
        { source: "KUKWIRA", credentials: {}, context: {} },
      ],
    });
    const keyed = resolveJobSearchConfig({ ...nothingSaved, jobSource: "MULTI", multiSources: ["JSEARCH"] }, { DOSSIER_JSEARCH_KEY: "ak" });
    expect(credentialsFor(keyed, "MULTI")).toEqual({ parts: [{ source: "JSEARCH", credentials: { key: "ak", host: "openwebninja" }, context: {} }] });
  });

  it("says what's missing when no source can be asked", () => {
    const keyless = resolveJobSearchConfig({ ...nothingSaved, jobSource: "MULTI", multiSources: ["JSEARCH"] }, noEnv);
    expect(() => credentialsFor(keyless, "MULTI")).toThrow("Add your JSearch key in Settings → Job search first.");
    const none = resolveJobSearchConfig({ ...nothingSaved, jobSource: "MULTI", multiSources: [] }, noEnv);
    expect(() => credentialsFor(none, "MULTI")).toThrow("Tick at least one source under Several sources in Settings → Job search.");
  });
});

describe("Mozambique's sources", () => {
  it("is chosen with DOSSIER_JOBS_SOURCE=emprego-mz, and needs no key", () => {
    const config = resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "emprego-mz" });
    expect(config.source).toBe("EMPREGO_MZ");
    expect(credentialsFor(config, "EMPREGO_MZ")).toEqual({});
  });

  it("chooses Kukwira with DOSSIER_JOBS_SOURCE=kukwira, which needs no key either", () => {
    const config = resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "kukwira" });
    expect(config.source).toBe("KUKWIRA");
    expect(credentialsFor(config, "KUKWIRA")).toEqual({});
  });
});

describe("FreeHire from the environment", () => {
  it("chooses FreeHire when DOSSIER_JOBS_SOURCE says so", () => {
    expect(resolveJobSearchConfig(nothingSaved, { DOSSIER_JOBS_SOURCE: "freehire" }).source).toBe("FREEHIRE");
  });

  it("searches freehire.me, or the self-hosted FreeHire DOSSIER_FREEHIRE_URL names", () => {
    expect(resolveJobSearchConfig(nothingSaved, noEnv).freehire).toEqual({ url: "https://freehire.me" });
    const own = resolveJobSearchConfig(nothingSaved, { DOSSIER_FREEHIRE_URL: "https://jobs.example:8443" });
    expect(own.freehire).toEqual({ url: "https://jobs.example:8443" });
    expect(jobSearchView(own).freehire).toEqual({ host: "jobs.example:8443" });
  });
});
