/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("conversations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.string("contact_phone", 32).notNullable();
    table.uuid("contact_id").nullable().references("id").inTable("contacts").onDelete("SET NULL");
    table.text("last_message_preview").nullable();
    table.timestamp("last_message_at", { useTz: true }).nullable();
    table.integer("unread_count").notNullable().defaultTo(0);
    table.string("status", 20).notNullable().defaultTo("open");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).nullable();
    table.unique(["org_id", "contact_phone"]);
    table.index(["org_id"], "idx_conversations_org_id");
    table.index(["last_message_at"], "idx_conversations_last_message_at");
  });

  await knex.schema.createTable("inbox_messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    table.uuid("conversation_id").notNullable().references("id").inTable("conversations").onDelete("CASCADE");
    table.string("wamid", 255).nullable().unique();
    table.string("direction", 12).notNullable();
    table.text("body").notNullable().defaultTo("");
    table.string("message_type", 30).notNullable().defaultTo("text");
    table.string("status", 20).notNullable().defaultTo("sent");
    table.string("source", 30).notNullable().defaultTo("customer");
    table.uuid("campaign_id").nullable().references("id").inTable("campaigns").onDelete("SET NULL");
    table.jsonb("meta").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["conversation_id"], "idx_inbox_messages_conversation_id");
    table.index(["org_id"], "idx_inbox_messages_org_id");
    table.index(["created_at"], "idx_inbox_messages_created_at");
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("inbox_messages");
  await knex.schema.dropTableIfExists("conversations");
};
