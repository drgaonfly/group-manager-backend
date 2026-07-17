import express from 'express';
import { getSetting, updateSetting } from '../controllers/settingController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', protect, getSetting);
router.put('/', protect, updateSetting);

export default router;
