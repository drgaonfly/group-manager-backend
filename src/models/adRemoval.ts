import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

// 处罚类型
export type PunishmentType = 'mute' | 'kick';

// 处罚配置
export interface IPunishment {
  type: PunishmentType;
  muteDuration?: number; // 禁言时长（秒），仅 type=mute 时有效
}

/**
 * 警告配置：在真正处罚前先给用户发警告
 * warningCount=0 表示不警告、直接处罚
 * warningWindowSeconds=0 表示不限制时间窗口（累计计数，不重置）
 */
export interface IWarningConfig {
  count: number; // 达到多少次警告后才触发处罚（0 = 直接处罚）
  windowSeconds: number; // 警告计数的时间窗口（秒，0 = 不限制）
  selfDestructSeconds: number; // 警告消息多少秒后自动删除（0 = 不删除）
}

// 主接口
export interface IAdRemoval extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  name: string;
  remark?: string;

  /**
   * 关键词列表。
   * 命中逻辑由 mode 控制：
   *   mode='any' → 消息含任意一个词即命中（OR）
   *   mode='all' → 消息含全部词才命中（AND）
   */
  keywords: string[];

  /**
   * 适用群组（单个 ObjectId）。
   * null / undefined 表示作用于该 bot 下所有群组。
   */
  group?: mongoose.Types.ObjectId;

  isOnline: boolean;
  ignoreAdmin: boolean;

  mode: 'any' | 'all'; // 词间匹配关系：any=含任意词命中（OR），all=含全部词才命中（AND）

  punishment?: IPunishment; // 处罚配置，不填则仅删除消息

  warning?: IWarningConfig; // 警告配置，不填或 warningCount=0 时直接处罚
}

const punishmentSchema = new Schema<IPunishment>(
  {
    type: {
      type: String,
      enum: ['mute', 'kick'],
      required: true,
    },
    muteDuration: {
      type: Number,
      min: 1,
    },
  },
  { _id: false },
);

const warningConfigSchema = new Schema<IWarningConfig>(
  {
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    windowSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    selfDestructSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

// 主 Schema
const adRemovalSchema = new Schema<IAdRemoval>(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      index: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    remark: {
      type: String,
      trim: true,
    },

    // 关键词列表，mode 控制词间匹配关系
    keywords: {
      type: [String],
      default: [],
    },

    // 适用群组，不填表示对该 bot 所有群组生效
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },

    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },

    ignoreAdmin: {
      type: Boolean,
      default: true,
    },

    mode: {
      type: String,
      enum: ['any', 'all'],
      default: 'any',
    },

    punishment: {
      type: punishmentSchema,
      default: null,
    },

    warning: {
      type: warningConfigSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

adRemovalSchema.index({ bot: 1, isOnline: 1 });
adRemovalSchema.index({ proxy: 1, isOnline: 1 });

// Model
const AdRemoval = mongoose.model<IAdRemoval>('AdRemoval', adRemovalSchema);

export default AdRemoval;
