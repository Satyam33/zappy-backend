/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.string("mobile", 20).nullable().unique();
  });

  await knex.schema.createTable("signup_otp_verifications", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("mobile", 20).notNullable();
    table.string("otp_hash", 64).notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    table.boolean("is_verified").notNullable().defaultTo(false);
    table.timestamp("verified_at", { useTz: true }).nullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("consumed_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["mobile"], "idx_signup_otp_mobile");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("signup_otp_verifications");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("mobile");
  });
};
