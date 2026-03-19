const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const sharp = require("sharp");

function sanitizeFileName(name) {
  return String(name || "upload.bin")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

function extnameSafe(name) {
  const ext = path.extname(name || "").toLowerCase();
  return ext || "";
}

function isImageFile(file) {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.startsWith("image/")) return true;

  const ext = extnameSafe(file?.originalname);
  return [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(ext);
}

function getUploadDir() {
  return path.resolve(__dirname, "../../../../temp/uploads");
}

async function ensureUploadDir() {
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

function localToWebFileUrl(localFileUrl) {
  const prefix = "local://temp/uploads/";
  if (!String(localFileUrl || "").startsWith(prefix)) return localFileUrl;
  const fileName = localFileUrl.slice(prefix.length);
  return `/uploads/${fileName}`;
}

function extractUploadFileName(fileUrl) {
  const raw = String(fileUrl || "").trim();
  if (!raw) return "";

  const localPrefix = "local://temp/uploads/";
  if (raw.startsWith(localPrefix)) {
    return path.basename(raw.slice(localPrefix.length));
  }

  if (raw.startsWith("/uploads/")) {
    return path.basename(raw.slice("/uploads/".length));
  }

  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname || "";
    if (pathname.startsWith("/uploads/")) {
      return path.basename(pathname.slice("/uploads/".length));
    }
  } catch {
    // ignore invalid absolute URL
  }

  return "";
}

function uploadUrlToAbsolutePath(fileUrl) {
  const fileName = extractUploadFileName(fileUrl);
  if (!fileName) return null;
  const uploadDir = getUploadDir();
  const absolutePath = path.resolve(uploadDir, fileName);
  if (!absolutePath.startsWith(uploadDir)) return null;
  return absolutePath;
}

async function deleteUploadedFileByUrl(fileUrl) {
  const absolutePath = uploadUrlToAbsolutePath(fileUrl);
  if (!absolutePath) return false;

  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

async function optimizeImageIfPossible(file) {
  if (!isImageFile(file)) {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype || "application/octet-stream",
      extension: extnameSafe(file.originalname) || ".bin",
      optimized: false,
    };
  }

  try {
    const originalSize = file.buffer.length;
    const optimizedBuffer = await sharp(file.buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 74, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();

    if (optimizedBuffer.length < originalSize * 0.98) {
      return {
        buffer: optimizedBuffer,
        mimeType: "image/jpeg",
        extension: ".jpg",
        optimized: true,
      };
    }

    return {
      buffer: file.buffer,
      mimeType: file.mimetype || "image/jpeg",
      extension: extnameSafe(file.originalname) || ".jpg",
      optimized: false,
    };
  } catch {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype || "application/octet-stream",
      extension: extnameSafe(file.originalname) || ".bin",
      optimized: false,
    };
  }
}

async function saveUploadedFile(file) {
  if (!file?.buffer || !file.originalname) {
    throw new Error("Arquivo invalido para upload");
  }

  const uploadDir = await ensureUploadDir();
  const optimized = await optimizeImageIfPossible(file);
  const baseName = sanitizeFileName(file.originalname).replace(/\.[^.]+$/, "");
  const extension = optimized.extension || ".bin";
  const fileName = `${Date.now()}-${randomUUID()}-${baseName}${extension}`;
  const absolutePath = path.join(uploadDir, fileName);

  await fs.writeFile(absolutePath, optimized.buffer);
  const localFileUrl = `local://temp/uploads/${fileName}`;

  return {
    absolutePath,
    localFileUrl,
    webFileUrl: localToWebFileUrl(localFileUrl),
    fileName,
    mimeType: optimized.mimeType || file.mimetype || "application/octet-stream",
    size: optimized.buffer.length,
    originalSize: file.size || file.buffer.length,
    optimized: optimized.optimized,
  };
}

module.exports = {
  saveUploadedFile,
  localToWebFileUrl,
  getUploadDir,
  uploadUrlToAbsolutePath,
  deleteUploadedFileByUrl,
};
