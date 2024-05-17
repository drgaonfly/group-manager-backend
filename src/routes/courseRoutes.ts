// src/routes/courseRoutes.ts
import express, { Router } from 'express';
import {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  deleteMultipleCourses
} from '../controllers/courseController';
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from "../constants";

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getAllCourses)  // Get list of courses
  .post(protect, allow(ROLES.Admin), createCourse)  // Add a new course
  .delete(protect, allow([ROLES.Admin]), deleteMultipleCourses);

router
  .route('/:id')
  .get(protect, allow([ROLES.Admin]), getCourseById)  // Get details of a specific course
  .put(protect, allow(ROLES.Admin), updateCourse)  // Update a course
  .delete(protect, allow(ROLES.Admin), deleteCourse);  // Delete a specific course

export default router;