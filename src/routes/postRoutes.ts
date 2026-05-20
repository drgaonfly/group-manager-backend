import { Router } from 'express';
import {
  getPosts,
  getPostById,
  deletePost,
  deleteMultiplePosts,
} from '../controllers/postController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', protect, checkPermission, getPosts);
router.get('/:id', protect, checkPermission, getPostById);
router.delete('/', protect, checkPermission, deleteMultiplePosts);
router.delete('/batch', protect, checkPermission, deleteMultiplePosts);
router.delete('/:id', protect, checkPermission, deletePost);

export default router;
