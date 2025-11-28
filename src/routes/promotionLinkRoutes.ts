import express, { Router } from 'express';
import {
  getPromotionLinks,
  getPromotionLinkById,
  addPromotionLink,
  updatePromotionLink,
  deletePromotionLink,
  deleteMultiplePromotionLinks,
} from '../controllers/promotionLinkController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getPromotionLinks)
  .post(protect, checkPermission, addPromotionLink)
  .delete(protect, checkPermission, deleteMultiplePromotionLinks);

router
  .route('/:id')
  .get(protect, checkPermission, getPromotionLinkById)
  .put(protect, checkPermission, updatePromotionLink)
  .delete(protect, checkPermission, deletePromotionLink);

export default router;
