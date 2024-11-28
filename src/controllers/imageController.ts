import { Request, Response } from 'express';
import multer from 'multer';
import handleAsync from '../utils/handleAsync';
import path from 'path';
import fs from 'fs';
import ossClient from '../utils/oss';
import s3 from '../utils/s3';
import {
  generateSignedUrlForOSS,
  generateSignedUrlForS3,
} from '../utils/generateSignedUrl';

export interface MulterFile extends Express.Multer.File {}

export interface CustomRequest extends Request {
  file: MulterFile;
}

// Configure multer to use disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use the /tmp directory for storing files temporarily
    cb(null, '/tmp');
  },
  filename: function (req, file, cb) {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}${fileExtension}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 200 },
});

export const handleFileUpload = upload.single('file');

export const uploadFileToS3 = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      res.status(400);
      throw new Error('No file provided');
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const key = `taskS3Uploads/${file.filename}`;
    const fileContent = fs.readFileSync(file.path);

    // Upload parameters for S3
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: file.mimetype,
    };

    // Upload file to S3
    await s3.upload(params).promise();

    // Use the utility function to generate a signed URL
    const signedURL = await generateSignedUrlForS3(key);

    // Optionally, remove the file from temporary storage
    fs.unlinkSync(file.path);

    // Respond with the signed URL
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: { signedURL, file: key },
    });
  },
);

export const uploadFileToOSS = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      res.status(400);
      throw new Error('No file provided');
    }

    const filePath = file.path; // This now points to the /tmp directory
    const ossPath = `taskOssUploads/${file.filename}`;

    // Read the file from /tmp directory
    const fileContent = fs.readFileSync(filePath);

    // Upload the file content to OSS
    await ossClient.put(ossPath, fileContent);

    // Optionally, delete the file from /tmp directory after uploading
    fs.unlinkSync(filePath);

    // Generate a signed URL with read permission (valid for 1 hour)
    const signedURL = await generateSignedUrlForOSS(ossPath);

    res.json({
      success: true,
      data: { signedURL, file: ossPath },
    });
  },
);

export const getOssCredentials = handleAsync(
  async (req: Request, res: Response) => {
    // Set the policy expiration time
    const policy = {
      expiration: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(), // Expires in 30 minutes
      conditions: [
        ['content-length-range', 0, 1048576000], // Limit upload size to no more than 1000MB
      ],
    };

    const result = (await ossClient.calculatePostSignature(policy)) as any;

    const host = `https://${process.env.OSS_BUCKET}.oss-cn-hongkong.aliyuncs.com`;

    res.json({
      accessId: process.env.OSS_ACCESS_KEY_ID,
      policy: result.policy,
      signature: result.Signature,
      host,
      dir: 'user-dir/',
      expire: new Date().getTime() + 30 * 60 * 1000, // Front-end use expiration time (milliseconds)
    });
  },
);
