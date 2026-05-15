import express, { Router } from 'express';
import {
  getBadges,
  getBadgeById,
  addBadge,
  updateBadge,
  deleteBadge,
  deleteMultipleBadges,
} from '../controllers/badgeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getBadges)
  .post(protect, checkPermission, addBadge)
  .delete(protect, checkPermission, deleteMultipleBadges);

router
  .route('/:id')
  .get(protect, checkPermission, getBadgeById)
  .put(protect, checkPermission, updateBadge)
  .delete(protect, checkPermission, deleteBadge);

export default router;
