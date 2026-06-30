import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBotUser } from './botUser';
import { IGroup } from './group';
import { IGroupMessage } from './groupMessage';
import { IBotUserMessage } from './botUserMessage';

export interface IBot extends Document {
  id: string; // Telegram Bot 数字 ID（字符串存储，来自 getMe）
  token: string;
  botName: string;
  remark?: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  message: string;
  userName: string;
  menus: IMenu[];
  isOnline: boolean;
  botUsers: mongoose.Schema.Types.ObjectId[] | IBotUser[];
  session?: string;
  contact?: string;
  help?: string;
  trx20_address?: string;
  customer_service_link?: string;
  owner?: mongoose.Schema.Types.ObjectId | IBotUser; // 单一拥有者（克隆时自动设置为操作者）
  authorized_users?: mongoose.Schema.Types.ObjectId[] | IBotUser[]; // 授权人，存 BotUser _id 关联
  creator?: mongoose.Schema.Types.ObjectId | IBotUser; // 创建者，存 BotUser _id 关联
  expireAt?: Date; // 到期时间
  type?: 'public' | 'private'; // 类型：public 可克隆，private 为克隆产物
  isExpired?: boolean; // 是否过期，默认 false
  preExpirationNotified?: boolean; // 是否已发送过期提醒，默认 false
  clonedFrom?: mongoose.Schema.Types.ObjectId | IBot; // 新增：从哪个机器人clone的
  canBeCloned?: boolean; // 新增：是否可克隆
  ownerPassword?: string; // 克隆时生成的明文密码，供 /start 构造自动登录链接用
  fee: number; // 闪兑费率
  auto_exchange_address: string; // 自动兑换地址
  private_key: string; // 私钥
  exchange_rate: number; // 闪兑汇率
  groups: mongoose.Schema.Types.ObjectId[] | IGroup[]; // 关联的群组
  webhook_url: string; // webhook url
  multi_image: string;
  multi_content: string;
  presets: Ipreset[];
  groupMessages: mongoose.Schema.Types.ObjectId[] | IGroupMessage[]; // 虚拟字段
  botUserMessages: mongoose.Schema.Types.ObjectId[] | IBotUserMessage[]; // 虚拟字段
  intervalTime: number;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;

  // 自由键盘（keyboards 数据仍保留）
  keyboards: IKeyboard[];

  // 定时频道 — cron job 用作查询过滤，保留
  canOpenChannelPost: boolean;

  // 名称变更播报 — cron job 用作查询过滤，保留
  canReportMemberNameUpdated: boolean;
}

export interface IMenu extends Document {
  name: string;
  url: string;
}

export interface IKeyboard extends Document {
  row: number;
  label: string;
  command: string;
  content: string;
}

export interface Ipreset extends Document {
  keyword: string;
  response: string;
}

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function (v: string): boolean {
        return /^(http|https):\/\/.*/.test(v);
      },
      message: (props: any): string => `${props.value} 不是一个有效的 URL!`,
    },
  },
});

const keyboardSchema = new mongoose.Schema({
  row: { type: Number, required: false, default: 1 },
  label: { type: String, required: false },
  command: { type: String, required: true },
  content: { type: String, required: true },
});

const presetSchema = new mongoose.Schema({
  keyword: { type: String, required: false },
  response: { type: String, required: false },
});

const botSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    botName: {
      type: String,
      trim: true,
    },
    remark: {
      type: String,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // start 消息
    message: {
      type: String,
      trim: true,
    },
    userName: { type: String, required: false },
    isOnline: {
      type: Boolean,
      default: true,
    },
    botUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BotUser',
      },
    ],
    menus: [menuSchema],
    keyboards: [keyboardSchema],
    session: {
      type: String,
      trim: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    help: {
      type: String,
      trim: true,
    },
    customer_service_link: {
      type: String,
      trim: true,
    },
    trx20_address: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      default: null,
    }, // 单一拥有者
    authorized_users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BotUser',
      },
    ], // 存 BotUser _id 关联
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
    }, // 创建者，存 BotUser _id 关联
    expireAt: {
      type: Date,
    },
    type: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
      trim: true,
    },
    isExpired: {
      type: Boolean,
      default: false,
    }, // 是否过期，默认 false
    preExpirationNotified: {
      type: Boolean,
      default: false,
    }, // 是否已发送过期提醒，默认 false
    clonedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
    }, // 新增：从哪个机器人clone的
    canBeCloned: {
      type: Boolean,
      default: false,
    }, // 是否可克隆
    ownerPassword: {
      type: String,
      trim: true,
      select: false, // 不在普通查询中返回，需要显式 select('+ownerPassword')
    }, // 克隆时生成的明文密码
    fee: {
      type: Number,
      default: 0,
    }, // 闪兑费用
    auto_exchange_address: {
      type: String,
      trim: true,
    }, // 自动兑换地址
    private_key: {
      type: String,
      trim: true,
    }, // 私钥
    exchange_rate: {
      type: Number,
      default: 0,
    }, // 闪兑汇率
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
    webhook_url: {
      type: String,
      trim: true,
    }, // 新增：webhook url
    multi_image: {
      type: String,
      trim: false,
    }, // 新增：抽奖图片
    multi_content: {
      type: String,
      trim: false,
    }, // 新增：抽奖描述
    presets: {
      type: [presetSchema],
      default: [],
    },
    intervalTime: {
      type: Number,
      required: false,
    },
    botUser: {
      type: mongoose.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },

    // 功能开关（仅保留作为 cron 查询过滤条件的字段）

    canOpenChannelPost: {
      type: Boolean,
      required: false,
      default: false,
    },

    canReportMemberNameUpdated: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

botSchema.virtual('groupMessages', {
  ref: 'GroupMessage',
  localField: '_id',
  foreignField: 'bot',
});

botSchema.virtual('botUserMessages', {
  ref: 'BotUserMessage',
  localField: '_id',
  foreignField: 'bot',
});

botSchema.virtual('channel_posts', {
  ref: 'ChannelPost',
  localField: '_id',
  foreignField: 'bot',
});

// 虚拟字段：关联的 BotUserConfig，用于统计/查看机器人下的用户配置
botSchema.virtual('botUserConfigs', {
  ref: 'BotUserConfig',
  localField: '_id',
  foreignField: 'bot',
});

// 虚拟字段：关联的抽奖活动
botSchema.virtual('lotteries', {
  ref: 'Lottery',
  localField: '_id',
  foreignField: 'bot',
});

// 虚拟字段：关联的竞拍活动
botSchema.virtual('auctions', {
  ref: 'Auction',
  localField: '_id',
  foreignField: 'bot',
});

// 虚拟字段：关联的去除广告规则详情
botSchema.virtual('adRemovals', {
  ref: 'AdRemoval',
  localField: '_id',
  foreignField: 'bot',
});

// 虚拟字段：关联的红包
botSchema.virtual('redPackets', {
  ref: 'RedPacket',
  localField: '_id',
  foreignField: 'bot',
});

const Bot = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
