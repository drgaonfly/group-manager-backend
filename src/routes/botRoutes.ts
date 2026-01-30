import express, { Router } from 'express';
import {
  getBots,
  getBotById,
  addBot,
  updateBot,
  deleteBot,
  deleteMultipleBots,
  addOwner,
  delOwner,
  addAuthorizer,
  delAuthorizer,
  sendMessage,
  sendGroupMessage,
  sendChannelPost,
  updateGroupWelcome,
} from '../controllers/botController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getBots)
  .post(protect, checkPermission, addBot)
  .delete(protect, checkPermission, deleteMultipleBots);

router
  .route('/:id')
  .get(protect, checkPermission, getBotById)
  .put(protect, checkPermission, updateBot)
  .delete(protect, checkPermission, deleteBot);

router.route('/:id/add-owner').put(protect, checkPermission, addOwner);

router.route('/:id/delete-owner').put(protect, checkPermission, delOwner);

router
  .route('/:id/add-authorizer')
  .put(protect, checkPermission, addAuthorizer);

router
  .route('/:id/delete-authorizer')
  .put(protect, checkPermission, delAuthorizer);

router.route('/:id/send-message').post(protect, checkPermission, sendMessage);

router
  .route('/:id/send-group-message')
  .put(protect, checkPermission, sendGroupMessage);

router
  .route('/:id/send-channel-post')
  .put(protect, checkPermission, sendChannelPost);

router
  .route('/:id/group-welcome')
  .put(protect, checkPermission, updateGroupWelcome);

export default router;
