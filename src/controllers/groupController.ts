import { Request, Response } from 'express';
import Group from '../models/group';
import Bot from '../models/bot';
import BotUserConfig from '../models/botUserConfig';
import BotUser from '../models/botUser';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from '../types/user';
import { setupBot } from '../bot/botSetup';
import { extractChatUsername } from '../utils/extractChannelTarget';

// 构建查询参数
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  // title（用于 Group 查询）
  if (queryParams.title) {
    query.title = queryParams.title;
  }

  // isOnline（用于 Group 查询）
  if (queryParams.isOnline) {
    query.isOnline = queryParams.isOnline;
  }

  // keyword 模糊搜索（用于 BotUser 查询）
  if (
    queryParams.keyword &&
    typeof queryParams.keyword === 'string' &&
    queryParams.keyword.trim()
  ) {
    const kw = queryParams.keyword.trim();
    query.$or = [
      { userName: { $regex: kw, $options: 'i' } },
      { firstName: { $regex: kw, $options: 'i' } },
      { lastName: { $regex: kw, $options: 'i' } },
    ];
  }

  // groups（用于 BotUser 查询，按群组过滤）
  if (queryParams.groups) {
    query.groups = queryParams.groups;
  }

  // 公共机器人：根据 Telegram 用户 ID 过滤（只显示该用户是 creator 或 operator 的群组）
  if (queryParams.tgUserId) {
    const botUser = await BotUser.findOne({
      id: queryParams.tgUserId.toString(),
    });

    if (botUser) {
      // 只显示该用户是创建者或操作员的群组
      query.$or = [{ creator: botUser._id }, { operators: botUser._id }];
    } else {
      // 如果找不到该用户，返回空结果
      query._id = null;
    }
  }

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  return query;
};

/**
 * 获取群组成员列表
 */
export const getGroupMembers = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { current = '1', pageSize = '20' } = req.query;

    const group = await Group.findById(id).select('_id title username type');

    if (!group) {
      res.status(404);
      throw new Error('群组不存在');
    }

    // 新逻辑：通过 BotUser.groups 反向查询群组成员
    const allMembers = await BotUser.find({ groups: group._id })
      .select('id userName firstName lastName createdAt')
      .sort('-createdAt');

    const total = allMembers.length;
    const start = (+current - 1) * +pageSize;
    const end = start + +pageSize;
    const paginatedMembers = allMembers.slice(start, end);

    res.json({
      success: true,
      data: {
        group: {
          _id: group._id,
          title: group.title,
          username: group.username,
          type: group.type,
        },
        members: paginatedMembers,
      },
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

/**
 * 获取群组成员列表（包含积分余额）
 * GET /groups/:id/members-with-balance?current=1&pageSize=20&keyword=xxx
 *
 * 多租户说明：
 * - 管理员：从 req.query.botId 或 req.body.bot 获取 botId
 * - 非管理员：强制使用 req.tenant（从 JWT 提取）
 */
export const getGroupMembersWithBalance = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const { current = '1', pageSize, keyword } = req.query;

    // 多租户：非管理员强制使用 JWT 中的 botId
    const botId =
      req.tenant || (req.query.botId as string) || (req.body.bot as string);

    if (!botId) {
      res.status(400);
      throw new Error('缺少机器人ID参数');
    }

    console.log('req.query', req.query);

    // 1. 获取群组基本信息
    const group = await Group.findById(id).select('title username type');

    if (!group) {
      res.status(404);
      throw new Error('群组不存在');
    }

    // 2. 构造查询条件（使用新的 groups 字段）
    const query = await buildQuery(
      {
        groups: group._id, // 直接使用群组 ID
        keyword,
      },
      req,
    );

    // 3. 查询总数
    const total = await BotUser.countDocuments(query);

    // 4. 分页查询
    const paginatedBotUsers = await BotUser.find(query)
      .select('id userName firstName lastName createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .lean();

    // 5. 如果当前页没有成员，直接返回
    if (paginatedBotUsers.length === 0) {
      res.json({
        success: true,
        data: {
          group: {
            _id: group._id,
            title: group.title,
            username: group.username,
            type: group.type,
          },
          members: [],
        },
        total,
        current: +current,
        pageSize: +pageSize,
      });
      return;
    }

    // 6. 提取当前页成员的 _id 列表
    const botUserIds = paginatedBotUsers
      .map((user: any) => user._id)
      .filter(Boolean);

    // 7. 批量查询 BotUserConfig（包含 usdt_balance）
    const botUserConfigs = await BotUserConfig.find({
      bot: botId,
      botUser: { $in: botUserIds },
    })
      .select('botUser usdt_balance')
      .lean()
      .exec();

    // 8. 创建 botUserId -> usdt_balance 的映射
    const balanceMap = new Map<string, number>();
    botUserConfigs.forEach((config: any) => {
      const botUserId = config.botUser.toString();
      balanceMap.set(botUserId, config.usdt_balance);
    });

    // 9. 合并数据：将 usdt_balance 添加到每个成员对象
    const enrichedMembers = paginatedBotUsers.map((user: any) => {
      const userId = user._id.toString();
      const usdt_balance = balanceMap.get(userId);

      return {
        _id: user._id,
        id: user.id,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        usdt_balance:
          usdt_balance !== undefined && usdt_balance !== null
            ? usdt_balance
            : 0,
        createdAt: user.createdAt,
      };
    });

    // 10. 返回结果
    res.json({
      success: true,
      data: {
        group: {
          _id: group._id,
          title: group.title,
          username: group.username,
          type: group.type,
        },
        members: enrichedMembers,
      },
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

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

// 获取所有群组
const getGroups = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const groups = await Group.find(query)
    .populate('bot')
    .populate('proxy')
    .populate('creator')
    .populate('operators')
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
/**
 * 多租户说明：
 * - 管理员：从 req.body.bot 获取 botId
 * - 非管理员：强制使用 req.tenant（从 JWT 提取）
 */
const addGroup = handleAsync(async (req: RequestCustom, res: Response) => {
  const newId = await IdGen.next(Group, 'id', 6);

  // 多租户：非管理员强制使用 JWT 中的 botId
  const botId = req.tenant || req.body.bot;

  if (!botId) {
    res.status(400);
    throw new Error('机器人ID是必填项');
  }

  // 获取机器人信息，判断是否为公共机器人
  const bot = await Bot.findById(botId);
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
    bot: botId,
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
const updateGroup = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;

  // 排除不允许外部修改的字段，proxy 强制使用服务端解析的 proxyUser
  const { proxy, bot, _id, ...safeBody } = req.body;

  const updatedGroup = await Group.findByIdAndUpdate(
    id,
    { ...safeBody, proxy: req.proxyUser?._id },
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
