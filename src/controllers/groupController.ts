import { Request, Response } from 'express';
import Group from '../models/group';
import Bot from '../models/bot';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from '../types/user';
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
const addGroup = handleAsync(async (req: RequestCustom, res: Response) => {
  const newId = await IdGen.next(Group, 'id', 6);

  // 获取机器人信息，判断是否为公共机器人
  const bot = await Bot.findById(req.body.bot);
  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 如果是公共机器人，需要设置proxy为当前用户（用于多租户隔离）
  // 如果是专属机器人，保持原有的proxy逻辑
  const proxy =
    bot.type === 'public' ? req.user._id : req.body.proxy || req.user._id;

  const newGroup = new Group({
    ...req.body,
    id: newId,
    proxy,
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

// 获取指定机器人的群组列表
const getGroupsByBotId = handleAsync(async (req: Request, res: Response) => {
  const { botId } = req.query;

  if (!botId) {
    res.status(400);
    throw new Error('缺少机器人ID参数');
  }

  console.log('botId', botId);

  try {
    // 返回机器人关联的群组
    const groups = await Group.find({ bot: botId });

    res.json({
      success: true,
      data: groups,
    });
  } catch (error: any) {
    res.status(500);
    throw new Error(error.message || '获取群组列表失败');
  }
});

/**
 * 检查机器人在指定群组列表中是否为管理员
 * GET /groups/checkBotAdmin?botId=xxx&groupIds=id1,id2,...
 *
 * 返回：
 * {
 *   success: true,
 *   data: [
 *     { groupId: "...", isAdmin: true },
 *     { groupId: "...", isAdmin: false, reason: "..." },
 *   ]
 * }
 */
const checkBotAdmin = handleAsync(async (req: Request, res: Response) => {
  const { botId, groupIds } = req.query;

  if (!botId) {
    res.status(400);
    throw new Error('缺少 botId 参数');
  }

  if (!groupIds) {
    res.status(400);
    throw new Error('缺少 groupIds 参数');
  }

  const bot = await Bot.findById(botId).select('token id').exec();
  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  if (!bot.token) {
    res.status(400);
    throw new Error('机器人 Token 无效');
  }

  // groupIds 支持逗号分隔字符串或数组
  const idList: string[] = Array.isArray(groupIds)
    ? (groupIds as string[])
    : (groupIds as string).split(',').filter(Boolean);

  // 批量查询群组的 Telegram chatId（存在 group.id 字段）
  const groups = await Group.find({ _id: { $in: idList } })
    .select('_id id title')
    .exec();

  const telegramBot = setupBot(bot.token);

  // 并行检查每个群组的管理员状态
  const results = await Promise.all(
    groups.map(async (group) => {
      const groupId = group._id.toString();
      const chatId = group.id; // Telegram 数字 chat id

      if (!chatId) {
        return {
          groupId,
          isAdmin: false,
          reason: '群组无效（缺少 Telegram chatId）',
        };
      }

      try {
        // bot.id 是字符串形式的 Telegram Bot 数字 ID
        const botTelegramId = Number(bot.id);
        if (!botTelegramId) {
          return {
            groupId,
            isAdmin: false,
            reason: '机器人 Telegram ID 未记录，请重新保存机器人信息',
          };
        }

        const member = await telegramBot.api.getChatMember(
          chatId,
          botTelegramId,
        );
        const isAdmin =
          member.status === 'administrator' || member.status === 'creator';

        return {
          groupId,
          isAdmin,
          ...(!isAdmin && { reason: '机器人不是该群组的管理员' }),
        };
      } catch (err: any) {
        return {
          groupId,
          isAdmin: false,
          reason: err?.description || err?.message || '检查失败',
        };
      }
    }),
  );

  res.json({
    success: true,
    data: results,
  });
});

export {
  getGroups,
  getGroupById,
  getGroupsByBotId,
  checkBotAdmin,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteMultipleGroups,
  verifyRequiredChannel,
};
