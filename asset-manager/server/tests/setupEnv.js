process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'asset_manager_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_access_secret_aaaaaaaaaaaaaaaaaaaaaaaa';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_bbbbbbbbbbbbbbbbbbbbbbbb';
process.env.BCRYPT_ROUNDS = '4';
process.env.MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
