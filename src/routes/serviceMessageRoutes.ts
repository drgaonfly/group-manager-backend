import express from 'express';
import {
  getServiceMessages,
  getServiceMessageById,
  getServiceMessageByBotAndGroup,
  createServiceMessage,
  updateServiceMessage,
  deleteServiceMessage,
  deleteMultipleServiceMessages,
} from '../controllers/serviceMessageController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getServiceMessages);
router.get('/by-bot-group', getServiceMessageByBotAndGroup);
router.get('/:id', getServiceMessageById);
router.post('/', createServiceMessage);
router.put('/:id', updateServiceMessage);
router.delete('/:id', deleteServiceMessage);
router.post('/batch-delete', deleteMultipleServiceMessages);

export default router;
