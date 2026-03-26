require("dotenv").config();

/** @type {import('knex').Knex.Config} */
const connectionString = process.env.DATABASE_URL;

// Some managed Postgres providers (e.g. Render) require SSL/TLS.
// We enable SSL automatically for those hosts, and allow explicit override via DB_SSL.
const dbSslRequested =
  process.env.DB_SSL === "true" ||
  process.env.PGSSLMODE === "require" ||
  (connectionString ? /render\.com/i.test(connectionString) : false);

module.exports = {
  client: "pg",
  connection: dbSslRequested
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : connectionString,
  migrations: {
    extension: "js",
    directory: "./src/db/migrations",
    loadExtensions: [".js"]
  }
};
