import { knex, type Knex } from "knex";
import { env } from "./env";

const buildKnex = (connection: string): Knex => {
  return knex({
    client: "pg",
    connection,
    pool: {
      min: 0,
      max: 10
    }
  });
};

const stripPasswordFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!parsed.password) {
      return null;
    }
    parsed.password = "";
    return parsed.toString();
  } catch {
    return null;
  }
};

export let db: Knex = buildKnex(env.DATABASE_URL);

export const ensureDatabaseConnection = async (): Promise<void> => {
  try {
    await db.raw("select 1");
    // eslint-disable-next-line no-console
    console.log("Database connection established");
    return;
  } catch (error) {
    const err = error as { message?: string };
    const message = err.message ?? "Database connection failed";
    const authFailed = message.toLowerCase().includes("password authentication failed");
    const fallbackUrl = stripPasswordFromUrl(env.DATABASE_URL);
    console.log("fallbackUrl",fallbackUrl)
    if (authFailed && fallbackUrl) {
      await db.destroy();
      db = buildKnex(fallbackUrl);
      try {
        await db.raw("select 1");
        // eslint-disable-next-line no-console
        console.log("Database connection established (fallback: no password)");
        return;
      } catch {
        // noop and throw clearer error below
      }
    }

    throw new Error(
      `Database connection failed. Please verify DATABASE_URL in .env (current user: postgres). Original error: ${message}`
    );
  }
};
