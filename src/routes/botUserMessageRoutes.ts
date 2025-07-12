import express, { Router } from 'express';
import {
  getBotUserMessages,
  getBotUserMessageById,
  addBotUserMessage,
  updateBotUserMessage,
  deleteBotUserMessage,
  deleteMultipleBotUserMessages,
} from '../controllers/botUserMessageController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getBotUserMessages)
  .post(protect, checkPermission, addBotUserMessage)
  .delete(protect, checkPermission, deleteMultipleBotUserMessages);

router
  .route('/:id')
  .get(protect, checkPermission, getBotUserMessageById)
  .put(protect, checkPermission, updateBotUserMessage)
  .delete(protect, checkPermission, deleteBotUserMessage);

export default router;
