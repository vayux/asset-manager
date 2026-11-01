const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-uploads-'));
process.env.UPLOAD_DIR = uploadDir;
delete process.env.SUPABASE_URL;

const app = require('../index');
const { sequelize } = require('../config/database');
const { resetDatabase } = require('./db');
const { supabaseDriver } = require('../services/storage');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

let alice;
let bob;
let investmentId;

const register = async (email) => {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Passw0rd!x', firstName: 'Alice', lastName: 'Files' });
  return { Authorization: `Bearer ${res.body.accessToken}` };
};

const uploadFile = (headers, buffer, name, entityId = investmentId, entityType = 'investment') => request(app)
  .post('/api/attachments').set(headers)
  .field('entityType', entityType).field('entityId', entityId)
  .attach('file', buffer, name);

beforeAll(async () => {
  await resetDatabase();
  alice = await register('alice-files@example.com');
  bob = await register('bob-files@example.com');
  const inv = await request(app).post('/api/investments').set(alice).send({ name: 'FD', category: 'fixed_deposit', currentAmount: 1000 });
  investmentId = inv.body.investment.id;
});

afterAll(async () => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  await sequelize.close();
});

describe('attachments', () => {
  let attachmentId;

  it('uploads a PDF to an owned item and lists it', async () => {
    const res = await uploadFile(alice, PDF, 'fd-receipt.pdf');
    expect(res.status).toBe(201);
    expect(res.body.attachment).toMatchObject({ fileName: 'fd-receipt.pdf', mimeType: 'application/pdf', sizeBytes: PDF.length });
    expect(res.body.attachment.storageKey).toBeUndefined();
    attachmentId = res.body.attachment.id;

    const list = await request(app).get(`/api/attachments?entityType=investment&entityId=${investmentId}`).set(alice);
    expect(list.body.attachments).toHaveLength(1);
  });

  it('downloads the same bytes for the owner only', async () => {
    const res = await request(app).get(`/api/attachments/${attachmentId}/download`).set(alice).buffer(true).parse((r, cb) => {
      const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="fd-receipt.pdf"');
    expect(Buffer.compare(res.body, PDF)).toBe(0);

    expect((await request(app).get(`/api/attachments/${attachmentId}/download`).set(bob)).status).toBe(404);
    expect((await request(app).delete(`/api/attachments/${attachmentId}`).set(bob)).status).toBe(404);
  });

  it("won't attach to someone else's item or list it", async () => {
    expect((await uploadFile(bob, PDF, 'x.pdf')).status).toBe(404);
    expect((await request(app).get(`/api/attachments?entityType=investment&entityId=${investmentId}`).set(bob)).status).toBe(404);
  });

  it('rejects files that are not PDF or images, whatever their name says', async () => {
    const res = await uploadFile(alice, Buffer.from('<script>alert(1)</script>'), 'evil.pdf');
    expect(res.status).toBe(415);
    expect((await uploadFile(alice, PNG, 'photo.png')).status).toBe(201);
  });

  it('rejects files over 10 MB', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    expect((await uploadFile(alice, big, 'big.pdf')).status).toBe(413);
  });

  it('validates entity type and id', async () => {
    expect((await uploadFile(alice, PDF, 'a.pdf', investmentId, 'goal')).status).toBe(400);
    expect((await uploadFile(alice, PDF, 'a.pdf', 'not-a-uuid')).status).toBe(400);
  });

  it('deletes the record and the stored file', async () => {
    const before = fs.readdirSync(uploadDir, { recursive: true }).filter(f => f.endsWith('.pdf'));
    expect(before).toHaveLength(1);
    expect((await request(app).delete(`/api/attachments/${attachmentId}`).set(alice)).status).toBe(200);
    expect(fs.readdirSync(uploadDir, { recursive: true }).filter(f => f.endsWith('.pdf'))).toHaveLength(0);
  });
});

describe('supabase storage driver', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('uploads, downloads and deletes through the Storage REST API with the service key', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', headers: opts.headers, body: opts.body });
      return { ok: true, status: 200, arrayBuffer: async () => PDF };
    });
    const driver = supabaseDriver({ url: 'https://proj.supabase.co/', serviceKey: 'service-key', bucket: 'attachments' });
    await driver.put('user-1/a.pdf', PDF, 'application/pdf');
    const data = await driver.get('user-1/a.pdf');
    await driver.remove('user-1/a.pdf');

    expect(calls[0]).toMatchObject({ url: 'https://proj.supabase.co/storage/v1/object/attachments/user-1/a.pdf', method: 'POST' });
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer service-key', 'Content-Type': 'application/pdf', 'x-upsert': 'false' });
    expect(Buffer.compare(data, PDF)).toBe(0);
    expect(calls[2]).toMatchObject({ url: 'https://proj.supabase.co/storage/v1/object/attachments', method: 'DELETE' });
    expect(JSON.parse(calls[2].body)).toEqual({ prefixes: ['user-1/a.pdf'] });
  });

  it('surfaces Supabase errors', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 403 }));
    const driver = supabaseDriver({ url: 'https://proj.supabase.co', serviceKey: 'k', bucket: 'b' });
    await expect(driver.put('k.pdf', PDF, 'application/pdf')).rejects.toThrow('Supabase upload failed with 403');
  });
});
