import express, { Router } from 'express';
import { getMessages, getMessageById } from '../controllers/messageController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/').get(protect, checkPermission, getMessages);

router.route('/:id').get(protect, checkPermission, getMessageById);

export default router;
