/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("organizations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 255).notNullable();
    table.uuid("owner_id").references("id").inTable("users").onDelete("SET NULL");
    table.string("plan_id", 50).notNullable().defaultTo("starter");
    table.string("waba_id", 255).unique().nullable();
    table.string("phone_number_id", 255).nullable();
    table.text("access_token").nullable();
    table.text("token_iv").nullable();
    table.text("token_auth_tag").nullable();
    table.string("quality_rating", 20).notNullable().defaultTo("GREEN");
    table.string("messaging_limit", 50).notNullable().defaultTo("TIER_1");
    table.string("timezone", 100).notNullable().defaultTo("Asia/Kolkata");
    table.string("opt_out_keyword", 50).notNullable().defaultTo("STOP");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("org_members", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("role", 50).notNullable().defaultTo("agent");
    table.uuid("invited_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("joined_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["org_id", "user_id"]);
    table.index(["org_id"], "idx_org_members_org_id");
    table.index(["user_id"], "idx_org_members_user_id");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("org_members");
  await knex.schema.dropTableIfExists("organizations");
};
