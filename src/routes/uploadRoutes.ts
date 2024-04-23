import express from 'express';
import { getOssCredentials, handleFileUpload } from '../controllers/uploadController';
import { uploadFileToOSS } from '../controllers/uploadController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/', protect, handleFileUpload, uploadFileToOSS);
router.get('/get-oss-credentials', protect, getOssCredentials);

export default router;