import express, { Router } from 'express';
import {
  getReceipts,
  getReceiptById,
  addReceipt,
  updateReceipt,
  deleteReceipt,
  deleteMultipleReceipts,
} from '../controllers/receiptController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getReceipts)
  .post(protect, checkPermission, addReceipt)
  .delete(protect, checkPermission, deleteMultipleReceipts);

router
  .route('/:id')
  .get(protect, checkPermission, getReceiptById)
  .put(protect, checkPermission, updateReceipt)
  .delete(protect, checkPermission, deleteReceipt);

export default router;
