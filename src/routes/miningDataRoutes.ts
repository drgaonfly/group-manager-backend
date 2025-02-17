import express, { Router } from 'express';
import {
  getMiningDataList,
  deleteMultipleMiningData,
  addMiningData,
  getMiningDataById,
  updateMiningData,
  deleteMiningData,
} from '../controllers/miningDataController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(getMiningDataList)
  .delete(protect, checkPermission, deleteMultipleMiningData)
  .post(addMiningData);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteMiningData)
  .get(protect, getMiningDataById)
  .put(protect, checkPermission, updateMiningData);

export default router;
