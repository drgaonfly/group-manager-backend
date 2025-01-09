import express, { Router } from 'express';
import {
  getStackingConfigurations,
  addStackingConfiguration,
  getStackingConfigurationById,
  updateStackingConfiguration,
  deleteStackingConfiguration,
  deleteMultipleStackingConfigurations,
} from '../controllers/stackingConfigurationController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 设置叠加配置记录的路由
router
  .route('/')
  .get(protect, checkPermission, getStackingConfigurations)
  .post(protect, checkPermission, addStackingConfiguration)
  .delete(protect, checkPermission, deleteMultipleStackingConfigurations);

router
  .route('/:id')
  .get(protect, checkPermission, getStackingConfigurationById)
  .put(protect, checkPermission, updateStackingConfiguration)
  .delete(protect, checkPermission, deleteStackingConfiguration);

export default router;
