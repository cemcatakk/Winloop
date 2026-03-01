/**
 * File routes: upload (multipart), serve by GUID.
 * Upload can be protected with auth; serve by GUID is public (or add auth if needed).
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fileService = require('../services/fileService');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: fileService.MAX_BYTES },
});

/** POST /files/upload — multipart form with field "file". Optional auth. */
router.post('/upload', optionalAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file', message: 'Field "file" required' });
    }
    const userId = req.user ? req.user.sub : null;
    const { guid } = await fileService.saveFile(req.file, userId);
    res.status(201).json({ guid });
  } catch (err) {
    if (err.message && (err.message.includes('too large') || err.message.includes('not allowed'))) {
      return res.status(400).json({ error: 'Bad request', message: err.message });
    }
    next(err);
  }
});

/** GET /files/:guid — serve file by GUID (no auth for public assets). */
router.get('/:guid', async (req, res, next) => {
  try {
    const file = await fileService.getByGuid(req.params.guid);
    if (!file) {
      return res.status(404).json({ error: 'Not found', message: 'File not found' });
    }
    res.setHeader('Content-Type', file.mimeType);
    if (file.originalName) {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    }
    res.sendFile(file.path, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
