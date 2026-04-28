import express, { Router } from 'express';
import * as adRemovalController from '../controllers/adRemovalController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, adRemovalController.getAdRemovals)
  .post(protect, checkPermission, adRemovalController.addAdRemoval)
  .delete(
    protect,
    checkPermission,
    adRemovalController.deleteMultipleAdRemovals,
  );

router
  .route('/:id')
  .get(protect, checkPermission, adRemovalController.getAdRemovalById)
  .put(protect, checkPermission, adRemovalController.updateAdRemoval)
  .delete(protect, checkPermission, adRemovalController.deleteAdRemoval);

export default router;
