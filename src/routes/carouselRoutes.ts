import express, { Router } from 'express';
import {
  getCarousels,
  addCarousel,
  getCarouselById,
  updateCarousel,
  deleteCarousel,
  deleteMultipleCarousels,
} from '../controllers/carouselController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 设置活动记录的路由。
router
  .route('/')
  .get(protect, checkPermission, getCarousels)
  .post(protect, checkPermission, addCarousel)
  .delete(protect, checkPermission, deleteMultipleCarousels);

router
  .route('/:id')
  .get(protect, checkPermission, getCarouselById)
  .put(protect, checkPermission, updateCarousel)
  .delete(protect, checkPermission, deleteCarousel);

export default router;
