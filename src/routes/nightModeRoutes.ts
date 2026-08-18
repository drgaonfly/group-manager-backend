import express from 'express';
import {
  getNightModes,
  getNightModeById,
  getNightModeByBotAndGroup,
  createNightMode,
  updateNightMode,
  deleteNightMode,
  deleteMultipleNightModes,
} from '../controllers/nightModeController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getNightModes);
router.get('/by-bot-group', getNightModeByBotAndGroup);
router.get('/:id', getNightModeById);
router.post('/', createNightMode);
router.put('/:id', updateNightMode);
router.delete('/:id', deleteNightMode);
router.post('/batch-delete', deleteMultipleNightModes);

export default router;
