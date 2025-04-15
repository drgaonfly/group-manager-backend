import express, { Router } from 'express';
import {
  getStackings,
  addStacking,
  getStackingById,
  updateStaking,
  deleteStacking,
  deleteMultipleStackings,
  handleStackingTransfer,
  agreeStaking,
} from '../controllers/stackingController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';
const router: Router = express.Router();

// 处理质押转账记录
router.post(
  '/handle-stacking-transfer',
  customerProtect,
  handleStackingTransfer,
);

//后台确认质押转账
router.put('/:id/agreestaking', protect, checkPermission, agreeStaking);

// 设置叠加配置记录的路由
router
  .route('/')
  .get(protect, checkPermission, getStackings)
  .post(protect, checkPermission, addStacking)
  .delete(protect, checkPermission, deleteMultipleStackings);

router
  .route('/:id')
  .get(protect, checkPermission, getStackingById)
  .put(protect, checkPermission, updateStaking)
  .delete(protect, checkPermission, deleteStacking);

export default router;
