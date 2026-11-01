const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const { Attachment, Investment, Asset, Liability } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { getStorage, driverFor } = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_ITEM = 20;
const ENTITY_MODELS = { investment: Investment, asset: Asset, liability: Liability };

// Trust the file's first bytes, not the client-supplied type
const sniff = (buf) => {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
};

const safeName = (name) => String(name || 'file').replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'file';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 5 } });
const singleFile = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Files can be at most 10 MB' });
  return res.status(400).json({ message: 'Invalid upload' });
});

const entityValidators = (src) => [
  src('entityType').isIn(Object.keys(ENTITY_MODELS)).withMessage('entityType must be investment, asset or liability'),
  src('entityId').isUUID().withMessage('Invalid entityId'),
];

const ownsEntity = (userId, entityType, entityId) => ENTITY_MODELS[entityType].count({ where: { id: entityId, userId } });

const present = (a) => ({
  id: a.id, entityType: a.entityType, entityId: a.entityId, fileName: a.fileName,
  mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt,
});

router.get('/', [...entityValidators(query), handleValidation], async (req, res) => {
  const { entityType, entityId } = req.query;
  if (!(await ownsEntity(req.user.id, entityType, entityId))) return res.status(404).json({ message: 'Item not found' });
  const rows = await Attachment.findAll({ where: { userId: req.user.id, entityType, entityId }, order: [['createdAt', 'DESC']] });
  res.json({ attachments: rows.map(present) });
});

router.post('/', singleFile, [...entityValidators(body), handleValidation], async (req, res) => {
  const { entityType, entityId } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Attach a file in the "file" field' });
  if (!(await ownsEntity(req.user.id, entityType, entityId))) return res.status(404).json({ message: 'Item not found' });
  const type = sniff(req.file.buffer);
  if (!type) return res.status(415).json({ message: 'Only PDF, PNG, JPEG and WebP files are allowed' });
  const count = await Attachment.count({ where: { userId: req.user.id, entityType, entityId } });
  if (count >= MAX_PER_ITEM) return res.status(409).json({ message: `At most ${MAX_PER_ITEM} files per item` });

  const storage = getStorage();
  const storageKey = `${req.user.id}/${crypto.randomUUID()}.${type.ext}`;
  await storage.put(storageKey, req.file.buffer, type.mime);
  try {
    const attachment = await Attachment.create({
      userId: req.user.id, entityType, entityId, fileName: safeName(req.file.originalname),
      mimeType: type.mime, sizeBytes: req.file.size, storageDriver: storage.name, storageKey,
    });
    res.status(201).json({ attachment: present(attachment) });
  } catch (err) {
    await storage.remove(storageKey).catch(() => {});
    throw err;
  }
});

const findOwn = (req) => Attachment.findOne({ where: { id: req.params.id, userId: req.user.id } });

router.get('/:id/download', [param('id').isUUID(), handleValidation], async (req, res) => {
  const attachment = await findOwn(req);
  if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
  const data = await driverFor(attachment.storageDriver).get(attachment.storageKey);
  res.set({
    'Content-Type': attachment.mimeType,
    'Content-Disposition': `attachment; filename="${attachment.fileName.replace(/"/g, '')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.send(data);
});

router.delete('/:id', [param('id').isUUID(), handleValidation], async (req, res) => {
  const attachment = await findOwn(req);
  if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
  try {
    await driverFor(attachment.storageDriver).remove(attachment.storageKey);
  } catch (err) {
    logger.warn({ err: err.message, id: attachment.id }, 'Could not delete stored file');
  }
  await attachment.destroy();
  res.json({ message: 'Attachment deleted' });
});

module.exports = router;
