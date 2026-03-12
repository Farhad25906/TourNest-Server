import multer from "multer";
import { Request } from "express";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import fs from "fs/promises";

// Define Multer File interface
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Cloudinary result interface
interface CloudinaryResult {
  public_id: string;
  url: string;
  secure_url: string;
  [key: string]: any;
}

/* ----------------------------------
   Multer Storage Configuration
----------------------------------- */
const storage = multer.diskStorage({
  destination: function (
    req: Request,
    file: MulterFile,
    cb: (error: Error | null, destination: string) => void
  ) {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: function (
    req: Request,
    file: MulterFile,
    cb: (error: Error | null, filename: string) => void
  ) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

/* ----------------------------------
   Convert Image to WebP Safely
----------------------------------- */
const convertToWebP = async (filePath: string): Promise<string> => {
  const fileExt = path.extname(filePath).toLowerCase();

  // If already webp, return original path
  if (fileExt === ".webp") {
    return filePath;
  }

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, fileExt);
  const webpPath = path.join(dir, `${baseName}.webp`);

  await sharp(filePath)
    .webp({ quality: 85 })
    .toFile(webpPath);

  // Remove original file
  await fs.unlink(filePath);

  return webpPath;
};

/* ----------------------------------
   Upload Single File to Cloudinary
----------------------------------- */
const uploadToCloudinary = async (file: MulterFile): Promise<CloudinaryResult> => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });

  let uploadPath = file.path;

  try {
    // Process image: convert to WebP if not already WebP
    uploadPath = await convertToWebP(file.path);

    const publicId = path.basename(uploadPath, path.extname(uploadPath));

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(uploadPath, {
      public_id: publicId,
      format: "webp",
      resource_type: "image",
    });

    // Clean up the temp file after upload
    await fs.unlink(uploadPath);

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    // Cleanup in case of failure
    try {
      await fs.unlink(uploadPath);
      // If conversion failed, original file might still exist
      if (uploadPath !== file.path) {
        await fs.unlink(file.path).catch(() => { });
      }
    } catch (_) { }

    throw error;
  }
};

/* ----------------------------------
   Upload Multiple Files to Cloudinary
----------------------------------- */
const uploadMultipleToCloudinary = async (
  files: MulterFile[]
): Promise<CloudinaryResult[]> => {
  return Promise.all(files.map((file) => uploadToCloudinary(file)));
};

/* ----------------------------------
   Export Uploader
----------------------------------- */
export const fileUploader = {
  upload,
  uploadToCloudinary,
  uploadMultipleToCloudinary,
};