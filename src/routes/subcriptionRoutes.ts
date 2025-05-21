import express, { Router } from 'express';
import {
  getSubscriptions,
  getSubscriptionById,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  deleteMultipleSubscriptions,
} from '../controllers/subscriptionController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getSubscriptions)
  .post(protect, checkPermission, addSubscription)
  .delete(protect, checkPermission, deleteMultipleSubscriptions);

router
  .route('/:id')
  .get(protect, checkPermission, getSubscriptionById)
  .put(protect, checkPermission, updateSubscription)
  .delete(protect, checkPermission, deleteSubscription);

export default router;
