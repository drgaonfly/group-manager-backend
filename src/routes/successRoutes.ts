import { Router } from 'express';
import {
  getSuccesses,
  getSuccessById,
  deleteSuccess,
  deleteMultipleSuccesses,
} from '../controllers/successController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', protect, checkPermission, getSuccesses);
router.get('/:id', protect, checkPermission, getSuccessById);
router.delete('/batch', protect, checkPermission, deleteMultipleSuccesses);
router.delete('/:id', protect, checkPermission, deleteSuccess);

export default router;
