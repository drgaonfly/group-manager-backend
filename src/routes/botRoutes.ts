import express, { Router } from 'express';
import {
  getBots,
  getBotById,
  addBot,
  updateBot,
  deleteBot,
  deleteMultipleBots,
} from '../controllers/botController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 获取所有机器人、添加新机器人和批量删除机器人
router
  .route('/')
  .get(protect, checkPermission, getBots)
  .post(protect, checkPermission, addBot)
  .delete(protect, checkPermission, deleteMultipleBots);

// 根据 ID 获取、更新和删除机器人
router
  .route('/:id')
  .get(protect, checkPermission, getBotById)
  .put(protect, checkPermission, updateBot)
  .delete(protect, checkPermission, deleteBot);

export default router;
