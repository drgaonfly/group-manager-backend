import express, { Router } from 'express';
import { ethToUsdt, usdtToEth } from '../controllers/exchangeController';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/eth_to_usdt').post(customerProtect, ethToUsdt);

router.route('/usdt_to_eth').post(customerProtect, usdtToEth);

export default router;
