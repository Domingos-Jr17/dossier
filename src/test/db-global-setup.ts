import { execFileSync } from "node:child_process";
import path from "node:path";

import { testDatabaseUrl } from "./db";

/**
 * Creates the test database if needed and applies all migrations, once per
 * test run. Prisma's CLI runs on this Node, not through `yarn`, which
 * `execFileSync` can't start on Windows, where it is a .cmd file.
 */
export default function setup() {
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
