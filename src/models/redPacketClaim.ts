import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IRedPacket } from './redPacket';

export interface IRedPacketClaim extends Document {
  /** 所属红包 */
  redPacket: mongoose.Schema.Types.ObjectId | IRedPacket;

  /** 领取人 */
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;

  /** 系统随机分配给该用户的数字（范围 1 ~ totalSlots） */
  assignedNumber: number;

  /** 是否命中炸弹数字 */
  isBomb: boolean;

  /** 领取前积分余额快照 */
  pointsBefore: number;

  /**
   * 积分变动量
   * - 未中炸弹：+pointsPerSlot（正数）
   * - 中炸弹：  -pointsPerSlot × bombMultiplier（负数）
   */
  pointsDelta: number;

  /** 领取后积分余额快照 */
  pointsAfter: number;

  createdAt: Date;
  updatedAt: Date;
}

const redPacketClaimSchema = new mongoose.Schema<IRedPacketClaim>(
  {
    redPacket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RedPacket',
      required: true,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    assignedNumber: {
      type: Number,
      required: true,
    },
    isBomb: {
      type: Boolean,
      required: true,
      default: false,
    },
    pointsBefore: {
      type: Number,
      required: true,
    },
    pointsDelta: {
      type: Number,
      required: true,
    },
    pointsAfter: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

redPacketClaimSchema.index({ redPacket: 1 });
redPacketClaimSchema.index({ redPacket: 1, botUser: 1 }, { unique: true }); // 每个用户每个红包只能领一次
redPacketClaimSchema.index({ botUser: 1 });

const RedPacketClaim = mongoose.model<IRedPacketClaim>(
  'RedPacketClaim',
  redPacketClaimSchema,
);

export default RedPacketClaim;
