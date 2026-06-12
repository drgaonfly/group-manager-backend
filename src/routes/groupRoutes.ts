import express, { Router } from 'express';
import {
  getGroups,
  getGroupById,
  getGroupsByBotId,
  checkBotAdmin,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteMultipleGroups,
  verifyRequiredChannel,
} from '../controllers/groupController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getGroups)
  .post(protect, checkPermission, addGroup)
  .delete(protect, checkPermission, deleteMultipleGroups);

// 验证必须加入的频道
router.post('/verify-required-channel', verifyRequiredChannel);

// 获取指定机器人的群组列表 - 必须在 /:id 路由之前
router.get('/getByBotId', protect, checkPermission, getGroupsByBotId);

// 检查机器人在指定群组中是否为管理员 - 必须在 /:id 路由之前
router.get('/checkBotAdmin', protect, checkPermission, checkBotAdmin);

router
  .route('/:id')
  .get(protect, checkPermission, getGroupById)
  .put(protect, checkPermission, updateGroup)
  .delete(protect, checkPermission, deleteGroup);

export default router;
