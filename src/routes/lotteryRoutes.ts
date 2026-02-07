import { Router } from 'express';
import {
  getLotteries,
  getLottery,
  createLottery,
  updateLottery,
  deleteLottery,
  getLotteryParticipants,
  drawLottery,
  createLotteryPublic,
  getLotteriesByCreator,
  getLotteryPublic,
  getLotteryParticipantsPublic,
  cancelLotteryPublic,
  resendLotteryPublic,
  setFixedWinnerPublic,
} from '../controllers/lotteryController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// 公开路由（无需登录）- 必须放在动态路由之前
router.post('/public', createLotteryPublic);
router.get('/public/creator', getLotteriesByCreator);
router.get('/public/:id', getLotteryPublic);
router.get('/public/:id/participants', getLotteryParticipantsPublic);
router.post('/public/cancel', cancelLotteryPublic);
router.post('/public/resend', resendLotteryPublic);
router.post('/public/set-fixed-winner', setFixedWinnerPublic);

// 需要认证的路由 - 动态路由放在后面
router.get('/', protect, checkPermission, getLotteries);
router.post('/', protect, checkPermission, createLottery);
router.get('/:id', protect, checkPermission, getLottery);
router.put('/:id', protect, checkPermission, updateLottery);
router.delete('/:id', protect, checkPermission, deleteLottery);
router.get(
  '/:id/participants',
  protect,
  checkPermission,
  getLotteryParticipants,
);
router.post('/:id/draw', protect, checkPermission, drawLottery);

export default router;
