import { describe, expect, it, vi } from "vitest";

import { encodeS3Path, signS3Request, uploadOffsite, type OffsiteTarget } from "./backup-offsite";

vi.mock("@/lib/env", () => ({ env: {} }));

const SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const target: OffsiteTarget = {
  endpoint: "https://abc123.r2.cloudflarestorage.com",
  bucket: "dossier-backups",
  credentials: { keyId: "AKIAIOSFODNN7EXAMPLE", secret: SECRET, region: "auto" },
};
const now = new Date("2026-11-05T03:00:00Z");

describe("signS3Request", () => {
  it("signs the PUT Object example in Amazon's Signature Version 4 documentation", () => {
    const headers = signS3Request({
      method: "PUT",
      url: "https://examplebucket.s3.amazonaws.com/test%24file.text",
      headers: { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
      body: "Welcome to Amazon S3.",
      credentials: { keyId: "AKIAIOSFODNN7EXAMPLE", secret: SECRET, region: "us-east-1" },
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers["x-amz-content-sha256"]).toBe("44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
    expect(headers.authorization).toContain("Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
    expect(headers.authorization).toContain("SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class");
    expect(headers.authorization).toMatch(/Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/);
  });
});

describe("encodeS3Path", () => {
  it("encodes each segment and keeps the slashes", () => {
    expect(encodeS3Path("dossier-backup-nightly-2026-11-05-030000.json")).toBe("dossier-backup-nightly-2026-11-05-030000.json");
    expect(encodeS3Path("a b/test$file(1).text")).toBe("a%20b/test%24file%281%29.text");
  });
});

describe("uploadOffsite", () => {
  it("does nothing while no bucket is set", async () => {
    const send = vi.fn();
    expect(await uploadOffsite("backup.json", "{}", { target: null, send })).toBe("off");
    expect(send).not.toHaveBeenCalled();
  });

  it("puts the backup in the bucket, signed, without sending the secret", async () => {
    const send = vi.fn(async () => new Response(null, { status: 200 }));
    expect(await uploadOffsite("dossier-backup-nightly.json", '{"a":1}', { target, now, send })).toBe("uploaded");
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://abc123.r2.cloudflarestorage.com/dossier-backups/dossier-backup-nightly.json");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"a":1}');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toContain("Credential=AKIAIOSFODNN7EXAMPLE/20261105/auto/s3/aws4_request");
    expect(JSON.stringify(init)).not.toContain(SECRET);
  });

  it("says what the bucket answered when it refuses, never the keys", async () => {
    const send = vi.fn(async () => new Response("<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>", { status: 403 }));
    const error = await uploadOffsite("backup.json", "{}", { target, now, send }).catch((caught: Error) => caught);
    expect(error).toEqual(new Error("The off-site copy failed: the bucket answered 403 (AccessDenied)."));
    expect(String(error)).not.toContain(SECRET);
  });

  it("says when the bucket can't be reached", async () => {
    const send = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(uploadOffsite("backup.json", "{}", { target, now, send })).rejects.toThrow("The off-site copy failed: the bucket couldn't be reached.");
  });
});
