import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

export interface INightMode extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId | IGroup;

  /** 夜间模式是否启用 */
  isActive: boolean;

  /**
   * 开始时刻，UTC 午夜起的分钟偏移，范围 0–1439
   * 例如 22:00 → 1320，08:00 → 480
   */
  startAt: number;

  /**
   * 结束时刻，UTC 午夜起的分钟偏移，范围 0–1439
   * 允许跨午夜：startAt=1320 endAt=480 表示 22:00 到次日 08:00
   */
  endAt: number;

  createdAt: Date;
  updatedAt: Date;
}

const nightModeSchema = new mongoose.Schema(
  {
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startAt: {
      type: Number,
      required: true,
      min: 0,
      max: 1439,
    },
    endAt: {
      type: Number,
      required: true,
      min: 0,
      max: 1439,
    },
  },
  { timestamps: true },
);

// 同一 bot + group 只允许一条夜间模式配置
nightModeSchema.index({ bot: 1, group: 1 }, { unique: true });
nightModeSchema.index({ bot: 1 });
nightModeSchema.index({ proxy: 1 });
nightModeSchema.index({ group: 1 });
nightModeSchema.index({ isActive: 1 });

const NightMode = mongoose.model<INightMode>('NightMode', nightModeSchema);

export default NightMode;
