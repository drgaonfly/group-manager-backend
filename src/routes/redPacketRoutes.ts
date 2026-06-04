import { Router } from 'express';
import {
  getRedPackets,
  getRedPacketById,
  getRedPacketClaims,
  deleteRedPacket,
  deleteMultipleRedPackets,
  createRedPacketPublic,
  getGroupsForRedPacket,
} from '../controllers/redPacketController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// 公开路由（Web App 调用，无需登录）
router.post('/public', createRedPacketPublic);
router.get('/public/groups', getGroupsForRedPacket);

// 需要认证的路由
router.get('/', protect, checkPermission, getRedPackets);
router.get('/:id', protect, checkPermission, getRedPacketById);
router.get('/:id/claims', protect, checkPermission, getRedPacketClaims);
router.delete('/', protect, checkPermission, deleteMultipleRedPackets);
router.delete('/:id', protect, checkPermission, deleteRedPacket);

export default router;
