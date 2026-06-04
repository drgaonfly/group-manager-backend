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

// 公开上传（无需鉴权，供 Telegram WebApp 等无 token 场景使用）
router.post('/public', handleFileUpload, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: '未收到文件' });
    return;
  }
  const fileName = req.file.filename;
  res.json({
    success: true,
    data: {
      url: await generateSignedUrl(fileName),
      file: fileName,
    },
  });
});

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
