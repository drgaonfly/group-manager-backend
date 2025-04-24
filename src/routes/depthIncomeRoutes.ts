import express, { Router } from 'express';
import {
  getDepthIncomeById,
  updateDepthIncome,
  deleteDepthIncome,
  getDepthIncomeList,
  deleteMultipleDepthIncome,
  addDepthIncome,
  getAllDepthIncome,
} from '../controllers/depthIncomeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getDepthIncomeList)
  .delete(protect, checkPermission, deleteMultipleDepthIncome)
  .post(protect, checkPermission, addDepthIncome);

router.route('/latest').get(getAllDepthIncome);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteDepthIncome)
  .get(protect, checkPermission, getDepthIncomeById)
  .put(protect, checkPermission, updateDepthIncome);

export default router;
