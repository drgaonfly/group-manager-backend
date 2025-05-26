import express, { Router } from 'express';
import { receiveMessage } from '../controllers/receiverController';

const router: Router = express.Router();

router.route('/').post(receiveMessage);

export default router;
