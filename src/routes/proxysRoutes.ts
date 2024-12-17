import express, { Router } from 'express';
import {
  deleteMultipleProxies,
  updateProxy,
  deleteProxy,
  getProxys,
  addProxy,
  getProxyById,
} from '../controllers/proxyController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getProxys, checkPermission)
  .delete(protect, checkPermission, deleteMultipleProxies)
  .post(protect, checkPermission, addProxy);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteProxy)
  .get(protect, checkPermission, getProxyById)
  .put(protect, checkPermission, updateProxy);

export default router;
