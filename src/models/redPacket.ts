import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IGroup } from './group';
import { IRedPacketClaim } from './redPacketClaim';

export interface IRedPacket extends Document {
  /** 所属代理用户（权限隔离） */
  proxy: mongoose.Schema.Types.ObjectId | IUser;

  /** 所属机器人 */
  bot: mongoose.Schema.Types.ObjectId | IBot;

  /** 所在群组 */
  group: mongoose.Schema.Types.ObjectId | IGroup;

  /** 发起人（BotUser） */
  creator: mongoose.Schema.Types.ObjectId | IBotUser;

  /** 红包总积分（发起时从发起人账户扣除锁定） */
  totalPoints: number;

  /** 红包总份数，同时决定分配数字的范围 1 ~ totalSlots */
  totalSlots: number;

  /** 剩余可分配积分（动态减少，用于二倍均值法随机分配） */
  remainingAmount: number;

  /**
   * 炸弹数字列表（元素范围 1 ~ totalSlots）
   * 领到这些数字的用户触发炸弹惩罚
   */
  bombNumbers: number[];

  /**
   * 炸弹惩罚倍率，默认 1.2
   * 被炸扣款 = pointsPerSlot × bombMultiplier（向上取整）
   */
  bombMultiplier: number;

  /** 红包过期时间，过期后由定时任务触发结算 */
  expiredAt: Date;

  /**
   * 红包状态
   * - active：进行中，可以领取
   * - completed：全部领完（正常结束）
   * - expired：到期结束（可能有未领份额）
   * - cancelled：已取消
   */
  status: 'active' | 'completed' | 'expired' | 'cancelled';

  /**
   * 全炸标记：结算时若所有已领记录均为 isBomb=true，
   * 则将所有扣款总额退还给发起人
   */
  allBombed: boolean;

  /**
   * 最终结算完成标记
   * （未领份额退还、全炸退款等操作全部完成后置 true）
   */
  settled: boolean;

  /** 群内红包消息 ID（方便 bot 后续编辑/撤回红包消息） */
  messageId?: number;

  /** 发起人发红包时的积分余额快照（扣款前，用于审计） */
  creatorPointsBefore: number;

  /** 虚拟字段：领取记录列表 */
  claims?: IRedPacketClaim[];

  createdAt: Date;
  updatedAt: Date;
}

const redPacketSchema = new mongoose.Schema<IRedPacket>(
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
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    totalPoints: {
      type: Number,
      required: true,
      min: 1,
    },
    totalSlots: {
      type: Number,
      required: true,
      min: 1,
    },
    remainingAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    bombNumbers: {
      type: [Number],
      default: [],
    },
    bombMultiplier: {
      type: Number,
      default: 1.2,
      min: 1,
    },
    expiredAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired', 'cancelled'],
      default: 'active',
    },
    allBombed: {
      type: Boolean,
      default: false,
    },
    settled: {
      type: Boolean,
      default: false,
    },
    messageId: {
      type: Number,
      required: false,
    },
    creatorPointsBefore: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 虚拟字段：关联的领取记录
redPacketSchema.virtual('claims', {
  ref: 'RedPacketClaim',
  localField: '_id',
  foreignField: 'redPacket',
});

redPacketSchema.index({ bot: 1, status: 1 });
redPacketSchema.index({ bot: 1, group: 1, status: 1 });
redPacketSchema.index({ proxy: 1 });
redPacketSchema.index({ creator: 1 });
redPacketSchema.index({ status: 1, expiredAt: 1 }); // 过期扫描任务用

const RedPacket = mongoose.model<IRedPacket>('RedPacket', redPacketSchema);

export default RedPacket;
