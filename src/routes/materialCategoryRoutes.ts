import express, { Router } from 'express';
import {
    deleteMultipleMaterialCategories,
    updateMaterialCategory,
    deleteMaterialCategory,
    getMaterialCategories,
    addMaterialCategory,
    getMaterialCategoryById
} from '../controllers/materialCategoryController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// GET and POST requests for all material categories
router.route('/')
    .get(protect, getMaterialCategories)
    .post(protect, addMaterialCategory)

// DELETE request for multiple material categories
// Assuming you have a way to specify multiple IDs in the request body
router.route('/')
    .delete(protect, deleteMultipleMaterialCategories)

// GET, PUT, and DELETE requests for a single material category
router.route('/:id')
    .get(protect, getMaterialCategoryById)
    .put(protect, updateMaterialCategory)
    .delete(protect, deleteMaterialCategory); // Corrected to use deleteMaterialCategory here

export default router;