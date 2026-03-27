/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("templates", (table) => {
    table.string("meta_template_id", 255).nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable("templates", (table) => {
    table.dropColumn("meta_template_id");
  });
};
