import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import fs from "fs/promises";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "/uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload = multer({ storage: storage });

// Convert image to WebP format
const convertToWebP = async (filePath: string): Promise<string> => {
  const webpPath = filePath.replace(/\.[^.]+$/, ".webp");

  await sharp(filePath)
    .webp({ quality: 85 }) // High quality WebP
    .toFile(webpPath);

  // Delete original file
  await fs.unlink(filePath);

  return webpPath;
};

const uploadToCloudinary = async (file: Express.Multer.File) => {
  // Configuration
  cloudinary.config({
    cloud_name: "farhadhossen",
    api_key: "329794487428411",
    api_secret: "ATnVkiik6bBp2gydKASaiO1S_3s",
  });

  try {
    // Convert to WebP first
    const webpPath = await convertToWebP(file.path);

    // Update file path to WebP version
    const webpFilename = path.basename(webpPath, ".webp");

    // Upload to Cloudinary with WebP format
    const uploadResult = await cloudinary.uploader.upload(webpPath, {
      public_id: webpFilename,
      format: "webp",
      resource_type: "image",
    });

    // Clean up the WebP file after upload
    await fs.unlink(webpPath);

    return uploadResult;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    // Clean up on error
    try {
      await fs.unlink(file.path);
    } catch (cleanupError) {
      console.error("Error cleaning up file:", cleanupError);
    }
    throw error;
  }
};

// Upload multiple files to Cloudinary
const uploadMultipleToCloudinary = async (files: Express.Multer.File[]) => {
  const uploadPromises = files.map((file) => uploadToCloudinary(file));
  return await Promise.all(uploadPromises);
};

export const fileUploader = {
  upload,
  uploadToCloudinary,
  uploadMultipleToCloudinary,
};
