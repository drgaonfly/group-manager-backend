import express, { Router } from 'express';
import * as teacherController from '../controllers/teacherController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// ── 公开路由（Mini App 调用，无需登录） ────────────────────────────
router.get('/public/list', teacherController.getPublicTeachers);
router.get(
  '/public/evaluations',
  teacherController.getPublicTeacherEvaluations,
);
router.get('/public/me', teacherController.getMyTeacherProfile);
router.post('/public/register', teacherController.registerTeacherPublic);

// ── 需要认证的路由 ─────────────────────────────────────────────────
router
  .route('/')
  .get(protect, checkPermission, teacherController.getTeachers)
  .post(protect, checkPermission, teacherController.addTeacher)
  .delete(protect, checkPermission, teacherController.deleteMultipleTeachers);

router
  .route('/batch-update-burn-seconds')
  .put(protect, checkPermission, teacherController.batchUpdateBurnSeconds);

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
