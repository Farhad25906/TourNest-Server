import multer from "multer";
import { Request } from "express";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import fs from "fs/promises";

// Define Multer File interface
interface MulterFile {
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
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
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

  try {
    // Convert image to WebP
    const webpPath = await convertToWebP(file.path);
    const publicId = path.basename(webpPath, ".webp");

    // Upload WebP to Cloudinary
    const result = await cloudinary.uploader.upload(webpPath, {
      public_id: publicId,
      format: "webp",
      resource_type: "image",
    });

    // Clean up WebP after upload
    await fs.unlink(webpPath);

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    // Cleanup in case of failure
    try {
      await fs.unlink(file.path);
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