import express, { Router } from 'express';
import {
  getTags,
  getTagById,
  addTag,
  updateTag,
  deleteTag,
  deleteMultipleTags,
} from '../controllers/tagController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getTags, checkPermission)
  .post(protect, checkPermission, addTag)
  .delete(protect, checkPermission, deleteMultipleTags);

router
  .route('/:id')
  .get(protect, checkPermission, getTagById)
  .put(protect, checkPermission, updateTag)
  .delete(protect, checkPermission, deleteTag);

export default router;
