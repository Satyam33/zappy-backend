/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("organizations", (table) => {
    table.jsonb("webhook_events").nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable("organizations", (table) => {
    table.dropColumn("webhook_events");
  });
};
