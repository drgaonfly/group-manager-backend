import mongoose, { Document } from 'mongoose';
import { ICustomer } from './customer';

export interface ITeamBenefit extends Document {
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  parent: mongoose.Schema.Types.ObjectId | ICustomer; // 添加父级字段
  usdtIncome: number;
  ethIncome: number; // 以太坊实时收益
  incomeRate: number; // 添加收益率字段
  toAddress: string; // 收款地址
  toNetwork: string; // 网络
  fromAddress: string; // 转出地址
  fromNetwork: string; // 转出网络
  depth: number; // 深度
  earningTime: Date; // 收益生成时间
  sourceCustomer: mongoose.Schema.Types.ObjectId | ICustomer; // 原始来源用户
  sourceAddress: string; // 原始来源地址
  sourceNetwork: string; // 原始来源网络
  sourceUsdtIncome: number; // 原始来源USDT收益
  sourceEthIncome: number; // 原始来源ETH收益
}

const teamBenefitSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    depth: { type: Number, required: true }, // 所在地址产生收益时的深度
    incomeRate: { type: Number, required: true }, // 收益率
    ethIncome: { type: Number, default: 0 }, // 以太坊实时收益
    usdtIncome: { type: Number, required: true }, // USDT收益
    fromAddress: { type: String, required: true }, // 转出地址
    fromNetwork: { type: String, required: true }, // 转出网络
    toAddress: { type: String, required: true }, // 转入地址（父级收款地址）
    toNetwork: { type: String, required: true }, // 转入网络（父级收款网络）
    earningTime: { type: Date }, // 收益生成时间
    sourceCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    }, // 原始来源用户
    sourceAddress: { type: String, required: true }, // 原始来源地址
    sourceNetwork: { type: String, required: true }, // 原始来源网络
    sourceUsdtIncome: { type: Number, required: true }, // 原始来源USDT收益
    sourceEthIncome: { type: Number, required: true }, // 原始来源ETH收益
  },
  {
    timestamps: true, // 自动生成 createdAt 和 updatedAt 字段
  },
);

const TeamBenefit = mongoose.model<ITeamBenefit>(
  'TeamBenefit',
  teamBenefitSchema,
);

export default TeamBenefit;
