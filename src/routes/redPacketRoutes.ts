import { Router } from 'express';
import {
  getRedPackets,
  getRedPacketById,
  getRedPacketClaims,
  deleteRedPacket,
  deleteMultipleRedPackets,
  createRedPacketPublic,
} from '../controllers/redPacketController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// 公开路由（Web App 调用，无需登录）
router.post('/public', createRedPacketPublic);

// 需要认证的路由
router.get('/', protect, checkPermission, getRedPackets);
router.get('/:id', protect, checkPermission, getRedPacketById);
router.get('/:id/claims', protect, checkPermission, getRedPacketClaims);
router.delete('/batch', protect, checkPermission, deleteMultipleRedPackets);
router.delete('/:id', protect, checkPermission, deleteRedPacket);

export default router;
