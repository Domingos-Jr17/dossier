import "server-only";

import { createHash, createHmac } from "node:crypto";

import { env } from "@/lib/env";

// An off-site copy of each nightly backup (E10-7), in a bucket of an
// S3-compatible store such as Cloudflare R2, when DOSSIER_BACKUP_S3_* are set.
// The backups folder lives on the app's own disk, so a lost disk would take
// the backups with it. Requests are signed with AWS Signature Version 4
// here, so there is no SDK to add. Expiring old copies is the bucket's job
// (an R2 lifecycle rule), not Dossier's.

export type S3Credentials = { keyId: string; secret: string; region: string };

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** A path with each segment percent-encoded the way S3 signs it (RFC 3986). */
export const encodeS3Path = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");

/**
 * The headers that make a request to S3 valid: the ones passed in plus
 * x-amz-date, x-amz-content-sha256 and Authorization. The URL's path must be
 * encoded already (encodeS3Path); the request has no query string.
 */
export function signS3Request({
  method,
  url,
  headers = {},
  body,
  credentials,
  now,
}: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body: string | Buffer;
  credentials: S3Credentials;
  now: Date;
}): Record<string, string> {
  const target = new URL(url);
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = stamp.slice(0, 8);
  const payloadHash = sha256(body);
  const signed: Record<string, string> = { ...headers, host: target.host, "x-amz-content-sha256": payloadHash, "x-amz-date": stamp };

  const names = Object.keys(signed)
    .map((name) => name.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(signed).map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")]));
  const canonical = [method, target.pathname, "", ...names.map((name) => `${name}:${lower[name]}`), "", names.join(";"), payloadHash].join("\n");

  const scope = `${day}/${credentials.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${credentials.secret}`, day), credentials.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");

  return {
    ...signed,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.keyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
  };
}

export type OffsiteTarget = { endpoint: string; bucket: string; credentials: S3Credentials };

/** Where the off-site copy goes, or null while DOSSIER_BACKUP_S3_* aren't set. */
export function offsiteTarget(): OffsiteTarget | null {
  const { DOSSIER_BACKUP_S3_ENDPOINT: endpoint, DOSSIER_BACKUP_S3_BUCKET: bucket, DOSSIER_BACKUP_S3_KEY_ID: keyId, DOSSIER_BACKUP_S3_SECRET: secret } = env;
  if (!endpoint || !bucket || !keyId || !secret) return null;
  return { endpoint, bucket, credentials: { keyId, secret, region: env.DOSSIER_BACKUP_S3_REGION ?? "auto" } };
}

/** The error code S3 sends back in its XML, such as AccessDenied or NoSuchBucket. */
const errorCode = (xml: string) => /<Code>([A-Za-z0-9]+)<\/Code>/.exec(xml)?.[1];

/**
 * Puts one backup in the bucket. Resolves "off" when no bucket is set. A
 * failure says what the store answered, never the keys.
 */
export async function uploadOffsite(name: string, body: string, { target = offsiteTarget(), now = new Date(), send = fetch }: { target?: OffsiteTarget | null; now?: Date; send?: typeof fetch } = {}): Promise<"uploaded" | "off"> {
  if (!target) return "off";
  const url = `${target.endpoint}/${target.bucket}/${encodeS3Path(name)}`;
  const headers = signS3Request({ method: "PUT", url, headers: { "content-type": "application/json" }, body, credentials: target.credentials, now });
  let response: Response;
  try {
    response = await send(url, { method: "PUT", headers, body, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new Error("The off-site copy failed: the bucket couldn't be reached.");
  }
  if (response.ok) return "uploaded";
  const code = errorCode(await response.text().catch(() => ""));
  throw new Error(`The off-site copy failed: the bucket answered ${response.status}${code ? ` (${code})` : ""}.`);
}
