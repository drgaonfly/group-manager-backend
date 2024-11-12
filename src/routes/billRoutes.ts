import express, { Router } from 'express';
import {
  getBillById,
  updateBill,
  deleteBill,
  deleteMultipleBills,
  fetchBills,
  getBills,
  addBill,
} from '../controllers/billController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/fetch').get(protect, fetchBills);

router
  .route('/')
  .get(protect, checkPermission, getBills)
  .post(protect, checkPermission, addBill)
  .delete(protect, checkPermission, deleteMultipleBills);

router.get('/fetch', protect, fetchBills);

router
  .route('/:id')
  .get(protect, checkPermission, getBillById)
  .put(protect, checkPermission, updateBill)
  .delete(protect, checkPermission, deleteBill);

export default router;
