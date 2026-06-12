import express, { Router } from 'express';
import {
  getSpeechConfigs,
  getSpeechConfig,
  createSpeechConfig,
  updateSpeechConfig,
  deleteSpeechConfig,
} from '../controllers/speechConfigController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getSpeechConfigs)
  .post(protect, checkPermission, createSpeechConfig);

router
  .route('/:id')
  .get(protect, checkPermission, getSpeechConfig)
  .put(protect, checkPermission, updateSpeechConfig)
  .delete(protect, checkPermission, deleteSpeechConfig);

export default router;
