import express, { Router } from 'express';
import {
  getMiningOutputList,
  deleteMultipleMiningOutput,
  addMiningOutput,
  getMiningOutputById,
  updateMiningOutput,
  deleteMiningOutput,
} from '../controllers/miningOutputController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getMiningOutputList)
  .delete(protect, checkPermission, deleteMultipleMiningOutput)
  .post(protect, checkPermission, addMiningOutput);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteMiningOutput)
  .get(protect, getMiningOutputById)
  .put(protect, checkPermission, updateMiningOutput);

export default router;
