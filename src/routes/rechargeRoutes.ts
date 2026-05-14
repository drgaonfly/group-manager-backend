import express from 'express';
import {
  getRecharges,
  getRechargeById,
  addRecharge,
  updateRecharge,
  deleteRecharge,
  deleteMultipleRecharges,
} from '../controllers/rechargeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(checkPermission, getRecharges)
  .post(checkPermission, addRecharge)
  .delete(checkPermission, deleteMultipleRecharges);

router
  .route('/:id')
  .get(checkPermission, getRechargeById)
  .put(checkPermission, updateRecharge)
  .delete(checkPermission, deleteRecharge);

export default router;
