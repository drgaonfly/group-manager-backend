import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBotUser } from './botUser';
import { IGroup } from './group';

export interface IBot extends Document {
  token: string;
  botName: string;
  remark?: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  message: string;
  userName: string;
  menus: IMenu[];
  keyboards: IKeyboard[];
  isOnline: boolean;
  botUsers: mongoose.Schema.Types.ObjectId[] | IBotUser[];
  session?: string;
  contact?: string;
  trx20_address?: string;
  customer_service_link?: string;
  owners?: mongoose.Schema.Types.ObjectId[] | IBotUser[]; // 拥有者，存 BotUser _id 关联
  authorized_users?: mongoose.Schema.Types.ObjectId[] | IBotUser[]; // 授权人，存 BotUser _id 关联
  creator?: mongoose.Schema.Types.ObjectId | IBotUser; // 创建者，存 BotUser _id 关联
  expireAt?: Date; // 到期时间
  type?: 'public' | 'custom'; // 类型
  isExpired?: boolean; // 是否过期，默认 false
  preExpirationNotified?: boolean; // 是否已发送过期提醒，默认 false
  clonedFrom?: mongoose.Schema.Types.ObjectId | IBot; // 新增：从哪个机器人clone的
  canBeCloned?: boolean; // 新增：是否可克隆
  fee: number; // 闪兑费率
  auto_exchange_address: string; // 自动兑换地址
  private_key: string; // 私钥
  exchange_rate: number; // 闪兑汇率
  groups: mongoose.Schema.Types.ObjectId[] | IGroup[]; // 关联的群组
  webhook_url: string; // webhook url
  multi_image: string;
  multi_content: string;
  presets: Ipreset[];
}

export interface IMenu extends Document {
  menuName: string;
  url: string;
}

export interface IKeyboard extends Document {
  command: string;
  content: string;
}

export interface Ipreset extends Document {
  keyword: string;
  response: string;
}

const menuSchema = new mongoose.Schema({
  menuName: { type: String, required: true },
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
    customer_service_link: {
      type: String,
      trim: true,
    },
    trx20_address: {
      type: String,
      trim: true,
    },
    owners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BotUser',
      },
    ], // 存 BotUser _id 关联
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
      enum: ['public', 'custom'],
      default: 'custom',
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
    }, // 新增：是否可克隆
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
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const Bot = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
