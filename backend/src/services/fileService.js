/**
 * Central file service: upload any file, serve by GUID.
 * Files stored on disk under UPLOAD_DIR; metadata in file_uploads table.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../db/client');

const UPLOAD_DIR = path.resolve(process.cwd(), config.upload.dir);
const MAX_BYTES = config.upload.maxFileSizeMb * 1024 * 1024;

/** Allowed MIME types (extend as needed). Empty = allow all (use with caution). */
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/json', 'text/plain', 'text/csv',
]);

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Save uploaded file to disk and DB; return GUID.
 * @param {Express.Multer.File} file - multer file object
 * @param {string} [userId] - optional user id for created_by
 * @returns {Promise<{ guid: string }>}
 */
async function saveFile(file, userId = null) {
  if (!file || !file.buffer) {
    throw new Error('No file or buffer');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${config.upload.maxFileSizeMb} MB)`);
  }
  if (ALLOWED_MIMES.size > 0 && !ALLOWED_MIMES.has(file.mimetype)) {
    throw new Error(`MIME type not allowed: ${file.mimetype}`);
  }

  ensureUploadDir();
  const guid = uuidv4();
  const ext = path.extname(file.originalname || '') || '';
  const storagePath = path.join(UPLOAD_DIR, `${guid}${ext}`);

  fs.writeFileSync(storagePath, file.buffer);

  const relativePath = path.relative(process.cwd(), storagePath);
  await pool.query(
    `INSERT INTO file_uploads (guid, original_name, mime_type, size_bytes, storage_path, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [guid, file.originalname || null, file.mimetype, file.size, relativePath, userId]
  );

  return { guid };
}

/**
 * Get file metadata and full path by GUID.
 * @param {string} guid
 * @returns {Promise<{ path: string, mimeType: string, originalName: string } | null>}
 */
async function getByGuid(guid) {
  const res = await pool.query(
    'SELECT storage_path, mime_type, original_name FROM file_uploads WHERE guid = $1',
    [guid]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const fullPath = path.resolve(process.cwd(), row.storage_path);
  if (!fs.existsSync(fullPath)) return null;
  return {
    path: fullPath,
    mimeType: row.mime_type,
    originalName: row.original_name,
  };
}

module.exports = {
  saveFile,
  getByGuid,
  UPLOAD_DIR,
  MAX_BYTES,
  ALLOWED_MIMES,
};
