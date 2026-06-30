import express, { Router } from 'express';
import {
  login,
  getUserProfile,
  updateUserProfile,
  refreshToken,
  setup2FA,
  verify2FA,
  verify2FALogin,
  disable2FA,
  botLogin,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.post('/login', login);
router.post('/login/verify-2fa', verify2FALogin);
router.post('/bot-login', botLogin);

router.post('/refresh', refreshToken);

// 2FA routes
router.post('/2fa/setup', protect, setup2FA);
router.post('/2fa/verify', protect, verify2FA);
router.post('/2fa/disable', protect, disable2FA);

router
  .route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

export default router;
