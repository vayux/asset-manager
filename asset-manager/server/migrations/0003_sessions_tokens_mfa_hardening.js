const { encrypt, decrypt, isEncrypted, keyedHash } = require('../utils/secretBox');

const isHashedCodes = (codes) => codes.every((c) => /^[0-9a-f]{64}$/.test(c));

module.exports = {
  async up({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const run = (sql, options = {}) => sequelize.query(sql, { transaction, ...options });

      await run(`CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        token_hash varchar(64) NOT NULL,
        previous_token_hash varchar(64),
        rotated_at timestamptz,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        last_used_at timestamptz,
        user_agent varchar(512),
        ip varchar(64),
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )`);
      await run('CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id)');

      await run(`DO $$ BEGIN
        CREATE TYPE enum_user_tokens_type AS ENUM ('email_verification', 'password_reset');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
      await run(`CREATE TABLE IF NOT EXISTS user_tokens (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        type enum_user_tokens_type NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )`);
      await run('CREATE INDEX IF NOT EXISTS user_tokens_user_id_type ON user_tokens (user_id, type)');

      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_used_step integer');
      await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz');

      // Encrypt TOTP secrets and hash backup codes that were stored in plain text
      const [users] = await run('SELECT id, mfa_secret, backup_codes FROM users WHERE mfa_secret IS NOT NULL OR backup_codes IS NOT NULL');
      for (const user of users) {
        const secret = user.mfa_secret && !isEncrypted(user.mfa_secret) ? encrypt(user.mfa_secret) : user.mfa_secret;
        const codes = Array.isArray(user.backup_codes) && !isHashedCodes(user.backup_codes)
          ? user.backup_codes.map((code) => keyedHash(String(code).toUpperCase()))
          : user.backup_codes;
        await run('UPDATE users SET mfa_secret = :secret, backup_codes = :codes WHERE id = :id', {
          replacements: { id: user.id, secret, codes: codes == null ? null : JSON.stringify(codes) },
        });
      }
    });
  },

  // Backup codes stay hashed (they cannot be recovered); users can regenerate them
  async down({ context: queryInterface }) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const run = (sql, options = {}) => sequelize.query(sql, { transaction, ...options });
      const [users] = await run('SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL');
      for (const user of users) {
        await run('UPDATE users SET mfa_secret = :secret WHERE id = :id', { replacements: { id: user.id, secret: decrypt(user.mfa_secret) } });
      }
      await run('ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at');
      await run('ALTER TABLE users DROP COLUMN IF EXISTS mfa_last_used_step');
      await run('DROP TABLE IF EXISTS user_tokens');
      await run('DROP TYPE IF EXISTS enum_user_tokens_type');
      await run('DROP TABLE IF EXISTS sessions');
    });
  },
};
