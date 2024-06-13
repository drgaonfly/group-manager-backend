// src/controllers/CourseController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import Course from '../models/course';  // Updated import to use Course model
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';
import { ROLES } from '../constants';

export const createCourse = handleAsync(async (req: RequestCustom, res: Response) => {
  const courseData = new Course({
    ...req.body,
    user: req.body.user || req.user._id,  // Assuming 'user' is authenticated and attached to req
  });

  const savedCourse = await courseData.save();
  res.status(201).json({ success: true, data: savedCourse });
});

export const getAllCourses = handleAsync(async (req: RequestCustom, res: Response) => {
  // Extracting pagination and filter parameters or providing default values
  const { current = '1', pageSize = '10', title, _id } = req.query;

  const queryConditions: any = {};
  if (title) {
    queryConditions.title = title;
  }
  if (_id) {
    queryConditions._id = _id;
  }

  if (req.user.role !== ROLES.Admin && req.user.role !== ROLES.SuperAdmin) {
    queryConditions.videoType = req.user.role;
  }

  // Convert current and pageSize to numbers to use in skip and limit
  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  // Count total courses matching the query conditions for pagination
  const total = await Course.countDocuments(queryConditions);

  // Fetching courses with pagination applied
  let courses = await Course.find(queryConditions)
    .populate('user', '-password')  // Populate user but exclude password
    .sort('weight')  // Sort by weight in ascending order
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum);
  // Assuming transformCourseVideoUrl is defined somewhere
  courses = await transformDocumentImages(courses, ['videoUrl']);
  // Returning the paginated courses along with pagination details
  res.status(200).json({
    success: true,
    data: courses,
    total,
    current: currentNum,
    pageSize: pageSizeNum
  });
});

export const getCourseById = handleAsync(async (req: Request, res: Response) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    res.status(404)
    throw new Error('Course not found');
  }

  res.status(200).json({ success: true, data: course });
});

export const updateCourse = handleAsync(async (req: Request, res: Response) => {
  const update = { ...req.body };

  const course = await Course.findByIdAndUpdate(req.params.id, update, { new: true });

  if (!course) {
    res.status(404)
    throw new Error('Course not found');
  }

  res.status(200).json({ success: true, data: course });
});

export const deleteCourse = handleAsync(async (req: Request, res: Response) => {
  const course = await Course.findByIdAndDelete(req.params.id);

  if (!course) {
    res.status(404)
    throw new Error('Course not found');
  }

  res.status(200).json({ success: true, message: 'Course deleted successfully' });
});

export const deleteMultipleCourses = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of course IDs to delete

  if (!ids || !ids.length) {
    res.status(400)
    throw new Error('No course IDs provided to delete');
  }

  const result = await Course.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404)
    throw new Error('No courses found to delete');
  }

  res.json({ success: true, message: `${result.deletedCount} courses deleted successfully` });
});