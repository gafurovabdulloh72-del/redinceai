import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
const remote = /^(libsql|https?|wss?):\/\//.test(url);

export default (remote
  ? {
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: { url, authToken },
    }
  : {
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url },
    }) satisfies Config;
