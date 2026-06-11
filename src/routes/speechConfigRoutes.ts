import express, { Router } from 'express';
import {
  getSpeechConfig,
  upsertSpeechConfig,
} from '../controllers/speechConfigController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/').get(protect, checkPermission, getSpeechConfig);
router.route('/:botId').put(protect, checkPermission, upsertSpeechConfig);

export default router;
