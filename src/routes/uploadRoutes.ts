import express from 'express';
import {
  getOssCredentials,
  handleFileUpload,
  getS3Credentials,
} from '../controllers/uploadController';
import { uploadFileToOSS } from '../controllers/uploadController';
import { protect } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';
import { generateSignedUrl } from '../utils/generateSignedUrl';

const router = express.Router();

if (process.env.FILE_STORAGE === 'aliyun') {
  router.post('/frontend', customerProtect, handleFileUpload, uploadFileToOSS);
  router.get('/get-credentials/frontend', customerProtect, getOssCredentials);
} else {
  router.post('/', protect, handleFileUpload, async (req, res) => {
    // 只返回文件名
    const fileName = req.file.filename;
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        signedURL: await generateSignedUrl(fileName),
        file: fileName,
      },
    });
  });
  router.get('/get-credentials/frontend', customerProtect, getS3Credentials);
}

if (process.env.FILE_STORAGE === 'aliyun') {
  router.post('/', protect, handleFileUpload, uploadFileToOSS);
  router.get('/get-credentials', protect, getOssCredentials);
} else {
  router.post('/', protect, handleFileUpload, async (req, res) => {
    // 只返回文件名
    const fileName = req.file.filename;
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        signedURL: await generateSignedUrl(fileName),
        file: fileName,
      },
    });
  });
  router.get('/get-credentials', protect, getS3Credentials);
}

export default router;
