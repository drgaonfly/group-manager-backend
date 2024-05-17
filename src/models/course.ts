import mongoose, { Document } from 'mongoose';

// TypeScript interface for Course
export interface ICourse extends Document {
  videoUrl: string;  // URL of the video
  title: string;     // Title of the course
  duration: number;  // Duration of the course in minutes
  weight: number;    // Weight of the course
  user: mongoose.Schema.Types.ObjectId;
}

const courseSchema = new mongoose.Schema<ICourse>({
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  }
}, { timestamps: true });

// Mongoose model for Course
const Course = mongoose.model<ICourse>('Course', courseSchema);

export default Course;