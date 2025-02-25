import express, { Router } from 'express';
import {
  login,
  getCustomerProfile,
  refreshToken,
} from '../controllers/customerAuthController';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.route('/profile').get(customerProtect, getCustomerProfile);

export default router;
