const fs = require('fs/promises');
const path = require('path');

const FETCH_TIMEOUT_MS = 20000;

// Local disk: fine for one server with a persistent volume
const localDriver = (root) => {
  const resolve = (key) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  };
  return {
    name: 'local',
    async put(key, buffer) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer, { flag: 'wx' });
    },
    get: (key) => fs.readFile(resolve(key)),
    async remove(key) {
      await fs.rm(resolve(key), { force: true });
    },
  };
};

// Supabase Storage REST API, private bucket, service-role key stays on the server
const supabaseDriver = ({ url, serviceKey, bucket }) => {
  const base = `${url.replace(/\/$/, '')}/storage/v1/object`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  const objectUrl = (key) => `${base}/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const check = async (res, action) => {
    if (!res.ok) throw new Error(`Supabase ${action} failed with ${res.status}`);
    return res;
  };
  return {
    name: 'supabase',
    async put(key, buffer, contentType) {
      await check(await fetch(objectUrl(key), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false' },
        body: buffer,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }), 'upload');
    },
    async get(key) {
      const res = await check(await fetch(objectUrl(key), { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }), 'download');
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(key) {
      await check(await fetch(`${base}/${encodeURIComponent(bucket)}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [key] }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }), 'delete');
    },
  };
};

const createStorage = (env = process.env) => {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseDriver({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, bucket: env.SUPABASE_BUCKET || 'attachments' });
  }
  return localDriver(env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
};

let storage;
const getStorage = () => { storage = storage || createStorage(); return storage; };
// Attachments remember which driver stored them, so switching drivers keeps old files readable
const driverFor = (name) => {
  const current = getStorage();
  if (current.name === name) return current;
  if (name === 'local') return localDriver(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  throw new Error(`Storage driver ${name} is not configured`);
};

module.exports = { createStorage, getStorage, driverFor, localDriver, supabaseDriver };
