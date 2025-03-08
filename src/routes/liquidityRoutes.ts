import express, { Router } from 'express';
import {
  getLiquidityBenefits,
  addLiquidityBenefit,
  getLiquidityBenefitById,
  updateLiquidityBenefit,
  deleteLiquidityBenefit,
  deleteMultipleLiquidityBenefits,
} from '../controllers/liquiditybenefitsController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getLiquidityBenefits)
  .post(protect, checkPermission, addLiquidityBenefit)
  .delete(protect, checkPermission, deleteMultipleLiquidityBenefits);

router
  .route('/:id')
  .get(getLiquidityBenefitById)
  .put(protect, checkPermission, updateLiquidityBenefit)
  .delete(protect, checkPermission, deleteLiquidityBenefit);

export default router;
