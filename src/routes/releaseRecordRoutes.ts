import express, { Router } from 'express';
import {
  getReleaseRecords,
  addReleaseRecord,
  getReleaseRecordById,
  updateReleaseRecord,
  deleteReleaseRecord,
  deleteMultipleReleaseRecords,
} from '../controllers/releaseRecordController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getReleaseRecords)
  .post(protect, checkPermission, addReleaseRecord)
  .delete(protect, checkPermission, deleteMultipleReleaseRecords);

router
  .route('/:id')
  .get(protect, checkPermission, getReleaseRecordById)
  .put(protect, checkPermission, updateReleaseRecord)
  .delete(protect, checkPermission, deleteReleaseRecord);

export default router;
