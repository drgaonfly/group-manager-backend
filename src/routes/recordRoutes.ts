import express, { Router } from 'express';
import {
  getRecords,
  addRecord,
  getRecordById,
  updateRecord,
  deleteRecord,
  deleteMultipleRecords,
  getNewbieTraining,
  submitNewbieTraining,
  submitExam,
  getExam,
} from '../controllers/recordController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.get('/newbie-training', protect, getNewbieTraining);
router.post('/submit-newbie-training/:id', protect, submitNewbieTraining);

router.get('/exam', protect, getExam);
router.post('/submit-exam/:id', protect, submitExam);

router
  .route('/')
  .get(protect, checkPermission, getRecords)
  .post(protect, checkPermission, addRecord)
  .delete(protect, checkPermission, deleteMultipleRecords);

router
  .route('/:id')
  .get(protect, checkPermission, getRecordById)
  .put(protect, checkPermission, updateRecord)
  .delete(protect, checkPermission, deleteRecord);

export default router;
