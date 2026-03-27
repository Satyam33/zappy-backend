/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("contacts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.string("name", 255).nullable();
    table.string("phone", 20).notNullable();
    table.specificType("tags", "text[]").notNullable().defaultTo("{}");
    table.boolean("opted_in").notNullable().defaultTo(true);
    table.timestamp("opted_out_at", { useTz: true }).nullable();
    table.jsonb("custom_data").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["org_id", "phone"]);
    table.index(["org_id"], "idx_contacts_org_id");
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags)');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("contacts");
};
