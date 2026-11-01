module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_type varchar(20) NOT NULL CHECK (entity_type IN ('investment', 'asset', 'liability')),
        entity_id uuid NOT NULL,
        file_name varchar(255) NOT NULL,
        mime_type varchar(100) NOT NULL,
        size_bytes integer NOT NULL CHECK (size_bytes > 0),
        storage_driver varchar(20) NOT NULL,
        storage_key varchar(512) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS attachments_user_entity ON attachments (user_id, entity_type, entity_id);
    `);
  },

  async down({ context: queryInterface }) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS attachments;');
  },
};
