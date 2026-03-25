import { knex, type Knex } from "knex";
import { env } from "./env";
import dns from "node:dns";

// Render environments can sometimes prefer IPv6 and fail to route it.
// Prefer IPv4 when resolving DATABASE_URL hostname.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const stripPasswordFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!parsed.password) return null;
    parsed.password = "";
    return parsed.toString();
  } catch {
    return null;
  }
};

const ensureSslModeRequire = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("sslmode", "require");
    return parsed.toString();
  } catch {
    return null;
  }
};

const buildKnex = (connection: string): Knex => {
  console.log("connection", connection);

  // Convert connection string into pg options so we can also apply SSL settings.
  const parsed = new URL(connection);
  const dbName = parsed.pathname.replace(/^\//, "");
  const hostname = parsed.hostname.toLowerCase();
  // If user used `localhost`, prefer IPv4 loopback to avoid accidentally hitting
  // an IPv6 listener with different pg_hba rules.
  const host = hostname === "localhost" ? "127.0.0.1" : parsed.hostname;
  const sslmode = parsed.searchParams.get("sslmode");
  console.log("sslmode", hostname, sslmode);

  const ssl =
    sslmode && sslmode.toLowerCase() !== "disable"
      ? {
          // Works for many hosted Postgres providers (e.g., Render, Supabase).
          rejectUnauthorized: false,
        }
      : undefined;
  if (hostname === "localhost") {
    return knex({
      client: "pg",
      connection,
      pool: {
        min: 0,
        max: 10,
      },
    });
  } else {
    return knex({
      client: "pg",
      connection: {
        host,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: parsed.username,
        password: parsed.password ? parsed.password : undefined,
        database: dbName,
        ssl,
      },
      pool: {
        min: 0,
        max: 10,
      },
    });
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

    const authFailed = message
      .toLowerCase()
      .includes("password authentication failed");
    const sslRequired = message.toLowerCase().includes("ssl/tls required");
    const connectionReset =
      message.toLowerCase().includes("econnreset") ||
      message.toLowerCase().includes("connection reset");

    const isLocalDb = (() => {
      try {
        const u = new URL(env.DATABASE_URL);
        const host = u.hostname.toLowerCase();
        return host === "localhost" || host === "127.0.0.1";
      } catch {
        return false;
      }
    })();

    const parsedForLog = (() => {
      try {
        const u = new URL(env.DATABASE_URL);
        return {
          username: u.username,
          host: u.hostname,
          database: u.pathname.replace(/^\//, ""),
          hasPassword: Boolean(u.password),
        };
      } catch {
        return null;
      }
    })();

    const hasSslModeRequireAlready = (() => {
      try {
        const u = new URL(env.DATABASE_URL);
        return u.searchParams.get("sslmode")?.toLowerCase() === "require";
      } catch {
        return false;
      }
    })();

    // Only apply SSL-mode retry for non-local databases (Render/Supabase),
    // so local Postgres keeps working with its normal connection settings.
    if (
      !isLocalDb &&
      (sslRequired || (connectionReset && !hasSslModeRequireAlready))
    ) {
      const sslUrl = ensureSslModeRequire(env.DATABASE_URL);
      if (sslUrl) {
        await db.destroy();
        db = buildKnex(sslUrl);
        try {
          await db.raw("select 1");
          // eslint-disable-next-line no-console
          console.log(
            "Database connection established (sslmode=require retry)",
          );
          return;
        } catch {
          // noop and throw clearer error below
        }
      }
    }

    const safeInfo = parsedForLog
      ? ` (parsed user=${parsedForLog.username}, host=${parsedForLog.host}, db=${parsedForLog.database}, hasPassword=${parsedForLog.hasPassword})`
      : "";

    if (authFailed) {
      throw new Error(
        `Database password authentication failed. Check DATABASE_URL credentials (user/password)${safeInfo}. Original error: ${message}`,
      );
    }

    throw new Error(
      `Database connection failed. Please verify DATABASE_URL.${safeInfo} Original error: ${message}`,
    );
  }
};
