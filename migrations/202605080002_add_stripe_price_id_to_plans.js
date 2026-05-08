exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('plans', 'stripe_price_id');
  if (!hasColumn) {
    await knex.schema.alterTable('plans', (table) => {
      table.string('stripe_price_id', 128).nullable();
    });
  }
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('plans', 'stripe_price_id');
  if (hasColumn) {
    await knex.schema.alterTable('plans', (table) => {
      table.dropColumn('stripe_price_id');
    });
  }
};

