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

// 主接口
export interface IAdRemoval extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  name: string;
  remark?: string;

  /**
   * 关键词二维数组：外层每个元素对应 textarea 的一行，内层是该行按空格拆分的多个词。
   * 命中逻辑：一行内的词全部命中（AND），行与行之间任一命中（OR）。
   * 示例：[["广告", "推广"], ["代理"]] → 消息同时含"广告"和"推广"，或含"代理"，即命中。
   */
  keywords: string[][];

  /**
   * 适用群组（单个 ObjectId）。
   * null / undefined 表示作用于该 bot 下所有群组。
   */
  group?: mongoose.Types.ObjectId;

  isOnline: boolean;
  ignoreAdmin: boolean;

  mode: 'any' | 'all'; // 保留：控制行内多词是 any（含任意词）还是 all（含全部词）

  punishment?: IPunishment; // 处罚配置，不填则仅删除消息
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

    // 二维数组：每行是一组词（空格分隔），行间 OR，行内 AND/OR 由 mode 控制
    keywords: {
      type: [[String]],
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
