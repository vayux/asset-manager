const request = require('supertest');
const speakeasy = require('speakeasy');
const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { User } = require('../models');
const emailService = require('../utils/emailService');
const mfaUtils = require('../utils/mfa');
const migration0003 = require('../migrations/0003_sessions_tokens_mfa_hardening');

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${process.env.DB_NAME}"`);
}

const PASSWORD = 'Passw0rd!x';
const NEW_PASSWORD = 'N3wPassw0rd!';
const sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
let counter = 0;

const refreshCookie = (res) => {
  const cookie = (res.headers['set-cookie'] || []).find(c => c.startsWith('mm_refresh='));
  return cookie && cookie.split(';')[0];
};
const register = async () => {
  counter += 1;
  const email = `session${counter}@example.com`;
  const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD, firstName: 'Sam', lastName: 'Session' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  return { email, id: res.body.user.id, accessToken: res.body.accessToken, cookie: refreshCookie(res) };
};
const login = async (email, password = PASSWORD) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, accessToken: res.body.accessToken, cookie: refreshCookie(res) };
};
const refresh = (cookie) => request(app).post('/api/auth/refresh').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie || '');
const profile = (token) => request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
const mailsWith = (subject) => sendMail.mock.calls.map(([mail]) => mail).filter(mail => mail.subject.includes(subject));
const tokenFrom = (mail) => decodeURIComponent(mail.html.match(/token=([^"&]+)/)[1]);

beforeAll(async () => {
  await resetDatabase();
  emailService.setTransporterForTesting({ sendMail });
});

afterAll(async () => {
  emailService.setTransporterForTesting(null);
  await sequelize.close();
});

afterEach(() => {
  delete process.env.REFRESH_REUSE_GRACE_MS;
});

describe('refresh cookie sessions', () => {
  it('sets an httpOnly, SameSite=Strict cookie scoped to /api/auth', async () => {
    const { email } = await register();
    const { res } = await login(email);
    const header = res.headers['set-cookie'].find(c => c.startsWith('mm_refresh='));
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Strict/);
    expect(header).toMatch(/Path=\/api\/auth/);
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('requires the X-Requested-With header', async () => {
    const { cookie } = await register();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('rotates the refresh token and revokes the session when an old one is replayed', async () => {
    process.env.REFRESH_REUSE_GRACE_MS = '0';
    const { cookie } = await register();
    const first = await refresh(cookie);
    expect(first.status).toBe(200);
    const rotated = refreshCookie(first);
    expect(rotated).not.toBe(cookie);
    expect((await profile(first.body.accessToken)).status).toBe(200);

    const replay = await refresh(cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await profile(first.body.accessToken)).status).toBe(401);
    expect((await refresh(rotated)).status).toBe(401);
  });

  it('treats a replay right after rotation as a multi-tab race, not theft', async () => {
    const { cookie } = await register();
    const first = await refresh(cookie);
    const race = await refresh(cookie);
    expect(race.status).toBe(409);
    expect((await refresh(refreshCookie(first))).status).toBe(200);
  });

  it('logout ends the session for both tokens', async () => {
    const { accessToken, cookie } = await register();
    const out = await request(app).post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie);
    expect(out.status).toBe(200);
    const after = await profile(accessToken);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_REVOKED');
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('changing the password ends other sessions but keeps this one', async () => {
    const { email, accessToken } = await register();
    const other = await login(email);
    const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect((await profile(accessToken)).status).toBe(200);
    expect((await profile(other.accessToken)).status).toBe(401);
  });

  it('lists sessions, signs out other devices and cannot revoke another user\'s session', async () => {
    const { email, accessToken } = await register();
    const other = await login(email);
    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${accessToken}`);
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions.filter(s => s.current)).toHaveLength(1);

    const stranger = await register();
    const foreignId = list.body.sessions[0].id;
    const steal = await request(app).delete(`/api/auth/sessions/${foreignId}`).set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(steal.status).toBe(404);

    const all = await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${accessToken}`);
    expect(all.body.revoked).toBe(1);
    expect((await profile(other.accessToken)).status).toBe(401);
    expect((await profile(accessToken)).status).toBe(200);
  });
});

describe('MFA secrets at rest', () => {
  let account;
  let secret;
  let backupCodes;
  const totpAt = (offset) => speakeasy.totp({ secret, encoding: 'base32', time: Math.floor(Date.now() / 1000) + offset });
  const mfaLogin = async (method, code) => {
    const { res } = await login(account.email);
    return request(app).post('/api/auth/login/mfa').send({ mfaPendingToken: res.body.mfaPendingToken, method, code });
  };

  beforeAll(async () => {
    account = await register();
    const auth = { Authorization: `Bearer ${account.accessToken}` };
    secret = (await request(app).post('/api/mfa/setup/totp').set(auth).send({})).body.data.secret;
    const verify = await request(app).post('/api/mfa/setup/verify').set(auth).send({ token: totpAt(0) });
    backupCodes = verify.body.data.backupCodes;
  });

  it('stores the TOTP secret encrypted and backup codes hashed', async () => {
    const [[row]] = await sequelize.query('SELECT mfa_secret, backup_codes FROM users WHERE id = :id', { replacements: { id: account.id } });
    expect(row.mfa_secret).toMatch(/^v1:/);
    expect(row.mfa_secret).not.toContain(secret);
    expect(row.backup_codes).toHaveLength(8);
    row.backup_codes.forEach(hash => expect(hash).toMatch(/^[0-9a-f]{64}$/));
    expect(row.backup_codes).not.toContain(backupCodes[0]);
  });

  it('rejects a TOTP code that was already used', async () => {
    expect((await mfaLogin('totp', totpAt(0))).status).toBe(401);
    expect((await mfaLogin('totp', totpAt(30))).status).toBe(200);
    expect((await mfaLogin('totp', totpAt(30))).status).toBe(401);
  });

  it('accepts a hashed backup code once', async () => {
    expect((await mfaLogin('backup', backupCodes[1].toLowerCase())).status).toBe(200);
    expect((await mfaLogin('backup', backupCodes[1])).status).toBe(401);
  });

  it('migration encrypts legacy plaintext secrets and backup codes', async () => {
    const legacy = await register();
    await sequelize.query(`UPDATE users SET mfa_enabled = true, mfa_secret = 'JBSWY3DPEHPK3PXP', backup_codes = '["ABCDEF1234"]' WHERE id = :id`,
      { replacements: { id: legacy.id } });
    await migration0003.up({ context: sequelize.getQueryInterface() });
    const [[row]] = await sequelize.query('SELECT mfa_secret, backup_codes FROM users WHERE id = :id', { replacements: { id: legacy.id } });
    expect(row.mfa_secret).toMatch(/^v1:/);
    const user = await User.findByPk(legacy.id);
    expect(user.mfaSecret).toBe('JBSWY3DPEHPK3PXP');
    expect(mfaUtils.verifyBackupCode('abcdef1234', user.backupCodes).valid).toBe(true);
  });
});

describe('email verification', () => {
  it('emails a single-use link that confirms the address', async () => {
    sendMail.mockClear();
    const account = await register();
    const [mail] = mailsWith('Confirm your email');
    expect(mail.to).toBe(account.email);
    const token = tokenFrom(mail);
    expect((await profile(account.accessToken)).body.user.emailVerifiedAt).toBeNull();

    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);
    expect((await profile(account.accessToken)).body.user.emailVerifiedAt).toBeTruthy();
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
  });
});

describe('password reset', () => {
  it('answers the same for unknown emails and sends nothing', async () => {
    sendMail.mockClear();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(mailsWith('Reset your password')).toHaveLength(0);
  });

  it('resets the password once and ends existing sessions', async () => {
    const account = await register();
    sendMail.mockClear();
    await request(app).post('/api/auth/forgot-password').send({ email: account.email });
    const token = tokenFrom(mailsWith('Reset your password')[0]);

    const weak = await request(app).post('/api/auth/reset-password').send({ token, password: 'weak' });
    expect(weak.status).toBe(400);
    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD })).status).toBe(400);

    expect((await profile(account.accessToken)).status).toBe(401);
    expect((await refresh(account.cookie)).status).toBe(401);
    expect((await login(account.email)).res.status).toBe(401);
    expect((await login(account.email, NEW_PASSWORD)).res.status).toBe(200);
  });

  it('only the newest reset link works', async () => {
    const account = await register();
    sendMail.mockClear();
    await request(app).post('/api/auth/forgot-password').send({ email: account.email });
    await request(app).post('/api/auth/forgot-password').send({ email: account.email });
    const [older, newer] = mailsWith('Reset your password').map(tokenFrom);
    expect((await request(app).post('/api/auth/reset-password').send({ token: older, password: NEW_PASSWORD })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: newer, password: NEW_PASSWORD })).status).toBe(200);
  });
});

describe('request ids', () => {
  it('returns a request id and echoes a valid incoming one', async () => {
    const generated = await request(app).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await request(app).get('/api/health').set('X-Request-Id', 'trace-123');
    expect(echoed.headers['x-request-id']).toBe('trace-123');
    const unsafe = await request(app).get('/api/health').set('X-Request-Id', 'bad id with spaces');
    expect(unsafe.headers['x-request-id']).not.toContain('bad id');
  });
});
