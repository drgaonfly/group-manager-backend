import express, { Router } from 'express';
import {
  getMenus,
  getMenuById,
  addMenu,
  updateMenu,
  deleteMenu,
  deleteMultipleMenus,
} from '../controllers/menuController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getMenus)
  .post(protect, addMenu)
  .delete(protect, deleteMultipleMenus);

router
  .route('/:id')
  .get(protect, getMenuById)
  .put(protect, updateMenu)
  .delete(protect, deleteMenu);

export default router;
