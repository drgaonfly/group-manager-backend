import { Request, Response } from 'express';
import Group from '../models/group';
import Bot from '../models/bot';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from 'user';
import { setupBot } from '../bot/botSetup';
import { extractChatUsername } from '../utils/extractChannelTarget';

// 验证必须加入的频道（要求机器人必须是管理员）
export const verifyRequiredChannelCore = async (
  link: string,
  botId: string,
): Promise<{ success: boolean; message?: string; data?: any }> => {
  if (!link) {
    return { success: false, message: '请输入群组/频道链接' };
  }

  if (!botId) {
    return { success: false, message: '缺少机器人参数' };
  }

  const username = extractChatUsername(link);
  if (!username) {
    return { success: false, message: '无法识别的链接格式' };
  }

  // 获取指定的机器人
  const bot = await Bot.findById(botId).exec();
  if (!bot) {
    return { success: false, message: '机器人不存在' };
  }

  try {
    const telegramBot = setupBot(bot.token);

    // 获取群组信息
    const chat = await telegramBot.api.getChat(`@${username}`);

    if (chat.type === 'private') {
      return { success: false, message: '该链接不是群组或频道' };
    }

    // 检查机器人是否是管理员
    try {
      const botMember = await telegramBot.api.getChatMember(
        chat.id,
        bot.id as number,
      );
      if (
        botMember.status !== 'administrator' &&
        botMember.status !== 'creator'
      ) {
        return {
          success: false,
          message: '机器人不是该群组/频道的管理员，请先将机器人设为管理员',
        };
      }
    } catch (err: any) {
      console.error('检查机器人管理员状态失败:', err);
      return {
        success: false,
        message:
          '无法验证机器人权限，请确保机器人已加入该群组/频道并设为管理员',
      };
    }

    return {
      success: true,
      data: {
        title: chat.title,
        id: chat.id,
        username: chat.username,
        type: chat.type,
      },
    };
  } catch (error: any) {
    console.error('验证频道链接失败:', error);
    return {
      success: false,
      message: `验证失败: ${error.message || '未知错误'}`,
    };
  }
};

// 构建查询参数
const buildQuery = (queryParams: any, req: RequestCustom): any => {
  const query: any = {};

  // title
  if (queryParams.title) {
    query.title = queryParams.title;
  }

  // isOnline
  if (queryParams.isOnline) {
    query.isOnline = queryParams.isOnline;
  }

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  return query;
};

// 获取所有群组
const getGroups = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const groups = await Group.find(query)
    .populate('bot')
    .populate('proxy')
    .populate('creator')
    .populate('operators')
    .populate('botUsers')
    .populate('transactions')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Group.countDocuments(query).exec();

  res.json({
    success: true,
    data: groups,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 获取群组详情
const getGroupById = handleAsync(async (req: Request, res: Response) => {
  const group = await Group.findById(req.params.id)
    .populate('bot')
    .populate('creator')
    .populate('operators')
    .populate('botUsers')
    .populate('transactions')
    .exec();

  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: group,
  });
});

// 添加新群组
const addGroup = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Group, 'id', 6);

  const newGroup = new Group({
    ...req.body,
    id: newId,
  });

  const savedGroup = await newGroup.save();

  res.json({
    success: true,
    data: savedGroup,
  });
});

// 更新群组
const updateGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedGroup = await Group.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedGroup) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: updatedGroup,
  });
});

// 删除群组
const deleteGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const group = await Group.findByIdAndDelete(id).exec();

  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: { message: 'Group deleted successfully' },
  });
});

// 批量删除群组
const deleteMultipleGroups = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Group.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} groups deleted successfully`,
    });
  },
);

// 验证必须加入的频道
const verifyRequiredChannel = handleAsync(
  async (req: Request, res: Response) => {
    const { link, botId } = req.body;

    const result = await verifyRequiredChannelCore(link, botId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  },
);

export {
  getGroups,
  getGroupById,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteMultipleGroups,
  verifyRequiredChannel,
};
