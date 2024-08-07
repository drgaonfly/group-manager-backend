import express, { Router } from 'express';
import {
    deleteMultipleMaterialCategories,
    updateMaterialCategory,
    deleteMaterialCategory,
    getMaterialCategory,
    addMaterialCategory,
    getsavedMaterialCategoryById
} from '../controllers/materialCategoryController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .route('/')
    .get(protect, getMaterialCategory)
    .post(protect, addMaterialCategory)
    .delete(protect, deleteMaterialCategory);

router
    .route('/:id')
    .get(protect, getsavedMaterialCategoryById)
    .put(protect, updateMaterialCategory)
    .delete(protect, deleteMultipleMaterialCategories);

export default router;
