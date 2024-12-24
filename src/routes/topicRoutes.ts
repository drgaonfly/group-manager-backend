import express, { Router } from 'express';
import {
  getTopics,
  addTopic,
  getTopicById,
  updateTopic,
  deleteTopic,
} from '../controllers/topicController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getTopics)
  .post(protect, checkPermission, addTopic);

router
  .route('/:id')
  .get(protect, checkPermission, getTopicById)
  .put(protect, checkPermission, updateTopic)
  .delete(protect, checkPermission, deleteTopic);

export default router;
