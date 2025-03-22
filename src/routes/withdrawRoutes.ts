import express, { Router } from 'express';
import {
  getWithdraws,
  addWithdraw,
  getWithdrawById,
  updateWithdraw,
  deleteWithdraw,
  deleteMultipleWithdraws,
  getWithdrawByCustomerId,
} from '../controllers/withdrawController';
import {
  protect,
  checkPermission,
  customerProtect,
} from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 添加提现记录
router.post('/withdraw', customerProtect, addWithdraw);

// 设置提现记录的路由
router
  .route('/')
  .get(protect, checkPermission, getWithdraws)
  .post(protect, checkPermission, addWithdraw)
  .delete(protect, checkPermission, deleteMultipleWithdraws);

router
  .route('/:id')
  .get(protect, checkPermission, getWithdrawById)
  .put(protect, checkPermission, updateWithdraw)
  .delete(protect, checkPermission, deleteWithdraw);

router.route('/customer/:id').get(customerProtect, getWithdrawByCustomerId);

export default router;
