/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("templates", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").nullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.boolean("is_predefined").notNullable().defaultTo(false);
    table.string("name", 255).notNullable();
    table.string("category", 50).notNullable();
    table.string("language", 20).notNullable().defaultTo("en");
    table.string("template_type", 50).notNullable().defaultTo("TEXT");
    table.text("body").notNullable();
    table.string("status", 30).notNullable().defaultTo("draft");
    table.string("interactive_mode", 30).notNullable().defaultTo("none");
    table.jsonb("interactive_actions").notNullable().defaultTo("[]");
    table.jsonb("sample_values").notNullable().defaultTo("{}");
    table.specificType("variables", "text[]").notNullable().defaultTo("{}");
    table.text("rejection_reason").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).nullable();
    table.index(["org_id"], "idx_templates_org_id");
    table.index(["status"], "idx_templates_status");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("templates");
};
