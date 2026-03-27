/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("campaigns", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.string("name", 255).notNullable();
    table.uuid("template_id").nullable().references("id").inTable("templates").onDelete("SET NULL");
    table.string("template_name", 255).notNullable();
    table.string("status", 30).notNullable().defaultTo("draft");
    table.string("audience_mode", 20).notNullable().defaultTo("all");
    table.string("audience_tag", 100).nullable();
    table.jsonb("audience_contact_ids").notNullable().defaultTo("[]");
    table.integer("selected_audience").notNullable().defaultTo(0);
    table.integer("final_audience").notNullable().defaultTo(0);
    table.jsonb("parameter_mapping").notNullable().defaultTo("{}");
    table.jsonb("stats").notNullable().defaultTo(JSON.stringify({
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0
    }));
    table.text("error_reason").nullable();
    table.timestamp("scheduled_at", { useTz: true }).nullable();
    table.timestamp("sent_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).nullable();
    table.index(["org_id"], "idx_campaigns_org_id");
    table.index(["status"], "idx_campaigns_status");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("campaigns");
};
