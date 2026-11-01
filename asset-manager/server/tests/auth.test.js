const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { sequelize } = require('../config/database');
const { validateJWTSecret } = require('../utils/security');

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${process.env.DB_NAME}"`);
}

const credentials = { email: 'carol@example.com', password: 'Passw0rd!x' };
let user;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const res = await request(app).post('/api/auth/register').send({ ...credentials, firstName: 'Carol', lastName: 'Test' });
  expect(res.status).toBe(201);
  user = res.body;
});

afterAll(async () => {
  await sequelize.close();
});

const profileWith = (token) => request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);

describe('tokens', () => {
  it('issues only access/refresh tokens on login', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.token).toBeUndefined();
  });

  it('accepts a valid access token', async () => {
    expect((await profileWith(user.accessToken)).status).toBe(200);
  });

  it('rejects legacy tokens without issuer/audience', async () => {
    const legacy = jwt.sign({ userId: user.user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    expect((await profileWith(legacy)).status).toBe(401);
  });

  it('rejects tokens without the access type', async () => {
    const untyped = jwt.sign({ userId: user.user.id }, process.env.JWT_SECRET, {
      expiresIn: '15m', issuer: 'asset-manager', audience: 'asset-manager-client',
    });
    expect((await profileWith(untyped)).status).toBe(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    expect((await profileWith(user.refreshToken)).status).toBe(401);
  });

  it('rejects tokens signed with the old fallback secret', async () => {
    const forged = jwt.sign({ userId: user.user.id, type: 'access' }, 'fallback_secret', {
      issuer: 'asset-manager', audience: 'asset-manager-client',
    });
    expect((await profileWith(forged)).status).toBe(401);
  });
});

describe('JWT secret validation', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env.JWT_SECRET = original.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = original.JWT_REFRESH_SECRET;
  });

  it('accepts the configured secrets', () => {
    expect(() => validateJWTSecret()).not.toThrow();
  });

  it.each([
    ['missing', undefined],
    ['fallback', 'fallback_secret'],
    ['short', 'too-short'],
  ])('refuses a %s JWT_SECRET', (_label, value) => {
    if (value === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = value;
    expect(() => validateJWTSecret()).toThrow();
  });

  it('refuses identical access and refresh secrets', () => {
    process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
    expect(() => validateJWTSecret()).toThrow();
  });
});

const speakeasy = require('speakeasy');
const emailService = require('../utils/emailService');

const enableMfa = async (name) => {
  const email = `${name}@example.com`;
  const reg = await request(app).post('/api/auth/register').send({ email, password: credentials.password, firstName: 'Mfa', lastName: 'User' });
  const authHeader = { Authorization: `Bearer ${reg.body.accessToken}` };
  const setup = await request(app).post('/api/mfa/setup/totp').set(authHeader).send({});
  const { secret } = setup.body.data;
  const verify = await request(app).post('/api/mfa/setup/verify').set(authHeader)
    .send({ token: speakeasy.totp({ secret, encoding: 'base32' }) });
  expect(verify.status).toBe(200);
  return { email, secret, backupCodes: verify.body.data.backupCodes, id: reg.body.user.id };
};

const startLogin = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: credentials.password });
  expect(res.status).toBe(200);
  return res.body;
};

const finishLogin = (mfaPendingToken, method, code) => request(app)
  .post('/api/auth/login/mfa').send({ mfaPendingToken, method, code });

describe('MFA login challenge', () => {
  let dave;
  beforeAll(async () => {
    dave = await enableMfa('dave');
  });

  it('no longer exposes the unauthenticated emergency reset or email-OTP routes', async () => {
    expect((await request(app).post('/api/mfa/emergency-reset').send(credentials)).status).toBe(404);
    expect((await request(app).post('/api/mfa/email-otp/send').send({ email: dave.email })).status).toBe(404);
    expect((await request(app).post('/api/mfa/email-otp/verify').send({ email: dave.email, otp: '123456' })).status).toBe(404);
  });

  it('returns a challenge token instead of a session or user id', async () => {
    const body = await startLogin(dave.email);
    expect(body.requiresMFA).toBe(true);
    expect(body.mfaPendingToken).toBeTruthy();
    expect(body.userId).toBeUndefined();
    expect(body.accessToken).toBeUndefined();
    expect(body.methods).toEqual(expect.arrayContaining(['totp', 'backup']));
    expect((await profileWith(body.mfaPendingToken)).status).toBe(401);
  });

  it('rejects a wrong TOTP code and accepts the right one', async () => {
    const { mfaPendingToken } = await startLogin(dave.email);
    expect((await finishLogin(mfaPendingToken, 'totp', '000000')).status).toBe(401);
    const ok = await finishLogin(mfaPendingToken, 'totp', speakeasy.totp({ secret: dave.secret, encoding: 'base32' }));
    expect(ok.status).toBe(200);
    expect((await profileWith(ok.body.accessToken)).status).toBe(200);
  });

  it('accepts a backup code only once', async () => {
    const [code] = dave.backupCodes;
    const first = await startLogin(dave.email);
    expect((await finishLogin(first.mfaPendingToken, 'backup', code)).status).toBe(200);
    const second = await startLogin(dave.email);
    expect((await finishLogin(second.mfaPendingToken, 'backup', code)).status).toBe(401);
  });

  it('rejects forged or non-challenge tokens', async () => {
    const code = speakeasy.totp({ secret: dave.secret, encoding: 'base32' });
    const forged = jwt.sign({ userId: dave.id, type: 'mfa_pending' }, 'some-other-secret-value-0123456789abcdef', {
      issuer: 'asset-manager', audience: 'asset-manager-client',
    });
    const res = await finishLogin(forged, 'totp', code);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MFA_SESSION_INVALID');
    expect((await finishLogin(user.accessToken, 'totp', code)).status).toBe(401);
  });

  describe('email OTP', () => {
    let sendMail;
    beforeAll(() => {
      sendMail = jest.fn().mockResolvedValue(true);
      emailService.setTransporterForTesting({ sendMail });
    });
    afterAll(() => {
      emailService.setTransporterForTesting(null);
    });

    const lastOtp = () => sendMail.mock.calls
      .map(([mail]) => mail)
      .filter(mail => mail.subject.includes('Verification Code'))
      .at(-1).html.match(/>(\d{6})</)[1];

    it('offers email and verifies the emailed code', async () => {
      const { mfaPendingToken, methods } = await startLogin(dave.email);
      expect(methods).toContain('email');
      expect((await request(app).post('/api/auth/login/email-otp').send({ mfaPendingToken })).status).toBe(200);
      expect((await finishLogin(mfaPendingToken, 'email', lastOtp())).status).toBe(200);
    });

    it('invalidates the code after 5 wrong attempts', async () => {
      const { mfaPendingToken } = await startLogin(dave.email);
      await request(app).post('/api/auth/login/email-otp').send({ mfaPendingToken });
      const otp = lastOtp();
      const wrong = otp === '111111' ? '222222' : '111111';
      for (let i = 0; i < 5; i += 1) {
        expect((await finishLogin(mfaPendingToken, 'email', wrong)).status).toBe(401);
      }
      expect((await finishLogin(mfaPendingToken, 'email', otp)).status).toBe(401);
    });
  });

  it('limits verification attempts per account', async () => {
    const erin = await enableMfa('erin');
    let last;
    for (let i = 0; i < 11; i += 1) {
      const { mfaPendingToken } = await startLogin(erin.email);
      last = await finishLogin(mfaPendingToken, 'totp', '000000');
    }
    expect(last.status).toBe(429);
  });
});

describe('rate limits', () => {
  it('throttles token refresh', async () => {
    let last;
    for (let i = 0; i < 61; i += 1) {
      last = await request(app).post('/api/auth/refresh').send({ refreshToken: 'bogus' });
    }
    expect(last.status).toBe(429);
  });

  it('throttles failed logins per account', async () => {
    const statuses = [];
    for (let i = 0; i < 31; i += 1) {
      const res = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it('throttles failed logins per IP even when User-Agent and email change', async () => {
    let last;
    for (let i = 0; i < 60 && last?.status !== 429; i += 1) {
      last = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', `agent-${i}`)
        .send({ email: `nobody-${i}@example.com`, password: 'wrong-password' });
    }
    expect(last.status).toBe(429);
  });
});
