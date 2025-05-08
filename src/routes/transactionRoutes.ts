import express, { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteMultipleTransactions,
} from '../controllers/transactionController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getTransactions)
  .post(protect, checkPermission, addTransaction)
  .delete(protect, checkPermission, deleteMultipleTransactions);

router
  .route('/:id')
  .get(protect, checkPermission, getTransactionById)
  .put(protect, checkPermission, updateTransaction)
  .delete(protect, checkPermission, deleteTransaction);

export default router;
