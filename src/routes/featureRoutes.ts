import express, { Router } from 'express';
import {
  getFeatures,
  addFeature,
  getFeatureById,
  updateFeature,
  deleteFeature,
  deleteMultipleFeatures,
} from '../controllers/featureController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 设置特性的路由
router
  .route('/')
  .get(protect, checkPermission, getFeatures)
  .post(protect, checkPermission, addFeature)
  .delete(protect, checkPermission, deleteMultipleFeatures);

router
  .route('/:id')
  .get(protect, checkPermission, getFeatureById)
  .put(protect, checkPermission, updateFeature)
  .delete(protect, checkPermission, deleteFeature);

export default router;
