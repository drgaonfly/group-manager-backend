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

const router = Router();

// 需要认证的路由
router.get('/', getLotteries);
router.get('/:id', getLottery);
router.post('/', createLottery);
router.put('/:id', updateLottery);
router.delete('/:id', deleteLottery);
router.get('/:id/participants', getLotteryParticipants);
router.post('/:id/draw', drawLottery);

// 公开路由（无需登录）
router.post('/public', createLotteryPublic);
router.get('/public/creator', getLotteriesByCreator);
router.get('/public/:id', getLotteryPublic);
router.get('/public/:id/participants', getLotteryParticipantsPublic);
router.post('/public/cancel', cancelLotteryPublic);
router.post('/public/resend', resendLotteryPublic);
router.post('/public/set-fixed-winner', setFixedWinnerPublic);

export default router;
