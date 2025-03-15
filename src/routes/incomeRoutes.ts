import express, { Router } from 'express';
import {
  getIncomes,
  addIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
  deleteMultipleIncomes,
  getIncomesByAddressAndNetwork,
  calculateTotalIncome,
} from '../controllers/incomeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/address-income')
  .get(customerProtect, getIncomesByAddressAndNetwork);

// 计算用户总收益
router.get('/calculate-total', customerProtect, calculateTotalIncome);

// 设置收入记录的路由
router
  .route('/')
  .get(protect, checkPermission, getIncomes)
  .post(protect, checkPermission, addIncome)
  .delete(protect, checkPermission, deleteMultipleIncomes);

router
  .route('/:id')
  .get(protect, checkPermission, getIncomeById)
  .put(protect, checkPermission, updateIncome)
  .delete(protect, checkPermission, deleteIncome);

export default router;
