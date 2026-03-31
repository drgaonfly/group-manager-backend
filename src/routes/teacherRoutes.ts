import express, { Router } from 'express';
import * as teacherController from '../controllers/teacherController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, teacherController.getTeachers)
  .post(protect, checkPermission, teacherController.addTeacher)
  .delete(protect, checkPermission, teacherController.deleteMultipleTeachers);

router
  .route('/:id')
  .get(protect, checkPermission, teacherController.getTeacherById)
  .put(protect, checkPermission, teacherController.updateTeacher)
  .delete(protect, checkPermission, teacherController.deleteTeacher);

router
  .route('/:id/approve')
  .put(protect, checkPermission, teacherController.approveTeacher);
router
  .route('/:id/reject')
  .put(protect, checkPermission, teacherController.rejectTeacher);

export default router;
