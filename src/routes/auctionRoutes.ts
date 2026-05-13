import { Router } from 'express';
import {
  getAuctions,
  getAuction,
  createAuction,
  updateAuction,
  deleteAuction,
  getAuctionBids,
  endAuction,
  createAuctionPublic,
  getAuctionsByCreator,
  getAuctionPublic,
  getAuctionBidsPublic,
  cancelAuctionPublic,
} from '../controllers/auctionController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// 公开路由（无需登录）- 必须放在动态路由之前
router.post('/public', createAuctionPublic);
router.get('/public/creator', getAuctionsByCreator);
router.get('/public/:id', getAuctionPublic);
router.get('/public/:id/bids', getAuctionBidsPublic);
router.post('/public/cancel', cancelAuctionPublic);

// 需要认证的路由 - 动态路由放在后面
router.get('/', protect, checkPermission, getAuctions);
router.post('/', protect, checkPermission, createAuction);
router.get('/:id', protect, checkPermission, getAuction);
router.put('/:id', protect, checkPermission, updateAuction);
router.delete('/:id', protect, checkPermission, deleteAuction);
router.get('/:id/bids', protect, checkPermission, getAuctionBids);
router.post('/:id/end', protect, checkPermission, endAuction);

export default router;
