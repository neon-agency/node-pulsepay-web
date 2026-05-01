exports.up = async function up(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.string('login_layout', 20).nullable(); // split-left | split-right | centered
    table.string('login_title', 120).nullable();
    table.string('login_subtitle', 255).nullable();
    table.string('login_tagline', 255).nullable();
    table.jsonb('login_features').nullable(); // array<string> max 5 items
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('white_labels', (table) => {
    table.dropColumn('login_layout');
    table.dropColumn('login_title');
    table.dropColumn('login_subtitle');
    table.dropColumn('login_tagline');
    table.dropColumn('login_features');
  });
};
