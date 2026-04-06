exports.up = async function up(knex) {
  await knex.schema.createTable('recharge_request_payment_proofs', (table) => {
    table.string('id', 64).primary();
    table.string('recharge_request_id', 64).notNullable()
      .references('id')
      .inTable('recharge_requests')
      .onDelete('CASCADE');
    table.string('sender_phone', 32).notNullable();
    table.string('meta_message_id', 160).nullable();
    table.string('meta_media_id', 160).nullable();
    table.string('mime_type', 120).nullable();
    table.string('file_name', 255).nullable();
    table.text('caption').nullable();
    table.string('review_status', 40).notNullable().defaultTo('pending_review');
    table.string('analysis_provider', 80).nullable();
    table.text('analysis_summary').nullable();
    table.decimal('analysis_confidence', 5, 2).nullable();
    table.decimal('extracted_amount', 12, 2).nullable();
    table.boolean('matches_expected_amount').nullable();
    table.boolean('matches_pix_identifier').nullable();
    table.text('raw_analysis_json').nullable();
    table.string('reviewed_by_user_id', 64).nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.text('reviewer_notes').nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('recharge_request_payment_proofs', (table) => {
    table.index(['recharge_request_id', 'created_at'], 'idx_rr_payment_proofs_request_created');
    table.index(['review_status'], 'idx_rr_payment_proofs_status');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('recharge_request_payment_proofs');
};
