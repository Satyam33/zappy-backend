require("dotenv").config();

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: "pg",
  connection: process.env.DATABASE_URL,
  migrations: {
    extension: "js",
    directory: "./src/db/migrations",
    loadExtensions: [".js"]
  }
};
