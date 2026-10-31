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

describe('MFA endpoints', () => {
  it('no longer exposes the unauthenticated emergency reset', async () => {
    const res = await request(app).post('/api/mfa/emergency-reset').send(credentials);
    expect(res.status).toBe(404);
  });

  it('limits email OTP verification attempts per email', async () => {
    const attempt = (email) => request(app).post('/api/mfa/email-otp/verify').send({ email, otp: '123456' });
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(credentials.email)).status).toBe(400);
    }
    expect((await attempt(credentials.email)).status).toBe(429);
    expect((await attempt(credentials.email.toUpperCase())).status).toBe(429);
    expect((await attempt('someone-else@example.com')).status).toBe(400);
  });

  it('limits email OTP sends per email', async () => {
    const send = () => request(app).post('/api/mfa/email-otp/send').send({ email: credentials.email });
    for (let i = 0; i < 3; i += 1) {
      expect((await send()).status).not.toBe(429);
    }
    expect((await send()).status).toBe(429);
  });
});

describe('login rate limit', () => {
  it('cannot be bypassed by changing the User-Agent', async () => {
    let last;
    for (let i = 0; i < 51; i += 1) {
      last = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', `agent-${i}`)
        .send({ email: credentials.email, password: 'wrong-password' });
    }
    expect(last.status).toBe(429);
  });
});
