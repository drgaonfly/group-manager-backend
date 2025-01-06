import mongoose, { Document } from 'mongoose';
import { ITopic } from './topic';

export interface IUser extends Document {
  isAdmin: boolean;
  roles: any;
  email: string;
  password: string;
  name: string;
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  currentTopic: mongoose.Types.ObjectId | ITopic;
  currentExamTopic: mongoose.Types.ObjectId | ITopic;
  live: boolean;
  topics: Array<{
    topic: mongoose.Types.ObjectId | ITopic;
    status: 'pending' | 'doing' | 'success' | 'fail';
  }>;
  examTopics: Array<{
    topic: mongoose.Types.ObjectId | ITopic;
    status: 'pending' | 'doing' | 'success' | 'fail';
  }>;
  inviteCode: string;
  isOnline: boolean;
  topicCount: number;
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: false },
    live: {
      type: Boolean,
      default: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role', // Reference the Role model
      },
    ],
    // 新手训练相关
    currentTopic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
    },
    topics: [
      {
        topic: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Topic',
        },
        status: {
          type: String,
          enum: ['pending', 'doing', 'success', 'fail'],
          default: 'pending',
        },
      },
    ],
    // 考场相关
    currentExamTopic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
    },
    examTopics: [
      {
        topic: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Topic',
        },
        status: {
          type: String,
          enum: ['pending', 'doing', 'success', 'fail'],
          default: 'pending',
        },
      },
    ],
    inviteCode: {
      type: String,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    isOnline: {
      type: Boolean,
    },
    topicCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
