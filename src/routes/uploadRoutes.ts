import express from 'express';
import {
  getOssCredentials,
  handleFileUpload,
  uploadFilesToS3,
} from '../controllers/uploadController';
import { uploadFileToOSS } from '../controllers/uploadController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

if (process.env.FILE_STORAGE === 'aliyun') {
  router.post('/', protect, handleFileUpload, uploadFileToOSS);
  router.get('/get-oss-credentials', protect, getOssCredentials);
} else {
  router.post('/', protect, handleFileUpload, uploadFileToOSS);
  router.get('/get-oss-credentials', protect, uploadFilesToS3);
}

export default router;
