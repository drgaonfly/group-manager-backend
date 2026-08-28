import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Bot, { IBot } from '../models/bot';
import handleAsync from '../utils/handleAsync';
import User from '../models/user';
import BotUser from '../models/botUser';
import BotUserMessage from '../models/botUserMessage';
import Group from '../models/group';
import BotUserConfig from '../models/botUserConfig';
import { printWebhookInfo, setupBot } from '../bot/botSetup';
import { RequestCustom } from '../types/user';
import { isProxy } from '../middlewares/authMiddleware';
import { encrypt } from '../services/encrypt';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { buildInlineKeyboard } from '../utils/buildInlineKeyboard';
import { sendMediaMessage } from '../utils/sendMultiMedia';
import { getUserByUsername } from '../utils/getBotUserByUsername';
import { getBotInfoWithGramjs } from '../utils/getBotInfoWithGramjs';
import { getBotInfoByToken } from '../utils/getBotInfo';
import { startClientAndGetSession } from '../bot/services/gramClient';
import GroupMessage from '../models/groupMessage';
import ChannelPost from '../models/channelPost';

import dotenv from 'dotenv';
dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.token) {
    query.token = queryParams.token;
  }

  // id
  if (queryParams.id) {
    query.id = { $regex: queryParams.id, $options: 'i' };
  }

  // disabledAt - 支持按禁用时间筛选
  if (queryParams.disabledAt) {
    if (queryParams.disabledAt === 'null') {
      query.disabledAt = { $exists: false };
    } else if (queryParams.disabledAt === 'notnull') {
      query.disabledAt = { $exists: true };
    }
  }

  if (queryParams.botName) {
    query.botName = { $regex: queryParams.botName, $options: 'i' };
  }

  // userName
  if (queryParams.userName) {
    query.userName = { $regex: queryParams.userName, $options: 'i' };
  }

  if (queryParams.message) {
    query.message = { $regex: queryParams.message, $options: 'i' };
  }

  if (queryParams.remark) {
    query.remark = { $regex: queryParams.remark, $options: 'i' };
  }

  // type
  if (queryParams.type && queryParams.type !== '') {
    query.type = queryParams.type;
  }

  if (queryParams.isOnline !== undefined && queryParams.isOnline !== '') {
    query.isOnline = queryParams.isOnline === 'true';
  }

  if (queryParams.user) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.user));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.user).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.user = { $in: userData.map((user) => user._id) };
    } else {
      return null;
    }
  }

  // 多租户共享机器人逻辑：
  // - 公共机器人（type: 'public'）对所有用户可见
  // - 专属机器人（type: 'private'）只对拥有者可见
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.$or = [
      { type: 'public' }, // 显示所有公共机器人
      { user: req.user._id }, // 显示用户自己的专属机器人
    ];
  }

  return query;
};

const getBots = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  if (query === null) {
    res.json({
      success: true,
      data: [],
      total: 0,
      current: +current,
      pageSize: +pageSize,
    });
    return;
  }

  const bots = await Bot.find(query)
    .populate('user')
    .populate('owner')
    .populate('authorized_users')
    .populate('clonedFrom')
    .populate('creator')
    .populate('groups')
    .sort('-createdAt')
    .select('-private_key')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // 添加 botUserConfigs 数量、groups 数量和处理 signed URL
  const botsWithCountsAndUrls = await Promise.all(
    bots.map(async (bot) => {
      const botObj = bot.toObject ? bot.toObject() : bot;

      // 获取 botUserConfigs 数量
      const botUserConfigsCount = await BotUserConfig.countDocuments({
        bot: bot._id,
      });

      (botObj as any).botUserConfigsCount = botUserConfigsCount;

      // 处理 multi_image
      if (botObj.multi_image) {
        const signedUrl = await generateSignedUrl(botObj.multi_image);
        botObj.multi_image = signedUrl;
      }

      return botObj;
    }),
  );

  const total = await Bot.countDocuments(query).exec();

  console.log('getBots result:', { total, botsCount: bots.length, query });

  res.json({
    success: true,
    data: botsWithCountsAndUrls,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const setWebhook = async (botManager: IBot) => {
  const bot = setupBot(botManager.token);
  await printWebhookInfo(bot);

  console.log('删除 webhook');
  await bot.api.deleteWebhook();

  const allowedUpdates = [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'callback_query',
    'inline_query',
    'chosen_inline_result',
    'chat_member', // 群组成员变化（加入/离开）
    'my_chat_member', // bot 自己的成员状态变化
    'chat_join_request', // 加群请求
    'managed_bot', // managed bot 创建/更新
  ] as const;

  await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${botManager.token}`, {
    // @ts-ignore - managed_bot is a new update type (grammy 1.45.1+), TS cache may need refresh
    allowed_updates: allowedUpdates,
  });

  console.log(
    `Webhook ${botManager.token} 已设置为 ${WEBHOOK_URL}/bot-webhooks/${botManager._id}`,
  );

  console.log(`https://api.telegram.org/bot${botManager.token}/getWebhookInfo`);

  console.log('修改 webhook 之后');
  await printWebhookInfo(bot);

  botManager.webhook_url = `${WEBHOOK_URL}/bot-webhooks/${botManager._id}`;
  await botManager.save();
};

const addBot = handleAsync(async (req: RequestCustom, res: Response) => {
  console.log('WEBHOOK_URL', WEBHOOK_URL);

  // 当前机器人数量从数据库查询
  const currentBotCount = await Bot.countDocuments({ user: req.user._id });
  if (currentBotCount >= req.user.availableBotCount) {
    res.status(400);
    throw new Error('您已达到最大机器人数量');
  }

  const { token, isOnline, proxy } = req.body;

  const botExists = await Bot.findOne({ token });

  if (botExists) {
    res.status(400);
    throw new Error('该 Bot Token 已被使用，请使用其他 Token');
  }

  // 使用 gramjs 获取机器人信息
  let botInfo = null;
  try {
    botInfo = await getBotInfoWithGramjs(token);
    console.log('成功获取机器人信息:', botInfo);
  } catch (error) {
    console.log('获取机器人信息失败，继续创建机器人:', error);
    // 如果获取信息失败，仍然创建机器人，但不更新用户名等信息
  }

  const botManager = new Bot({
    ...req.body,
    user: proxy || req.user._id,
    // 如果成功获取到机器人信息，更新相关字段
    ...(botInfo && {
      userName: botInfo.username || '',
      botName: botInfo.firstName || botInfo.username || '',
      id: botInfo.id || '',
    }),
  });

  if (isOnline) {
    setWebhook(botManager);
  }

  await botManager.save();

  res.status(201).json({
    success: true,
    data: botManager,
  });
});

const getBotById = handleAsync(async (req: Request, res: Response) => {
  // 支持 ?username=xxx 过滤群组（public bot 场景，只返回该用户参与的群）
  // 支持 ?tgUserId=xxx 过滤群组（public bot 场景，只返回该用户是 creator 或 operator 的群）
  const { username, tgUserId: urlTgUserId } = req.query as {
    username?: string;
    tgUserId?: string;
  };

  // 从 JWT 中获取 tgUserId（优先使用 JWT 中的，防止用户篡改 URL 参数）
  const token = req.headers.authorization?.split(' ')[1];
  let jwtTgUserId: string | undefined;
  let hasJwtTgUserId = false; // 标记 JWT 中是否明确包含了 tgUserId 字段
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as any;
      if ('tgUserId' in decoded) {
        jwtTgUserId = decoded.tgUserId;
        hasJwtTgUserId = true;
      }
    } catch (err) {
      // JWT 解析失败，忽略
    }
  }

  // 如果 JWT 中有 tgUserId 字段（即使是 undefined），就使用 JWT 的值，忽略 URL 参数
  // 如果 JWT 中没有 tgUserId 字段（老版本或 Owner），才使用 URL 参数
  const tgUserId = hasJwtTgUserId ? jwtTgUserId : urlTgUserId;

  const bot = await Bot.findById(req.params.id)
    .populate({
      path: 'groups',
      populate: [
        {
          path: 'creator',
          select: 'id userName firstName lastName',
        },
        {
          path: 'operators',
          select: 'id userName firstName lastName',
        },
      ],
    })
    .populate('owner')
    .populate('botUserConfigs');

  if (!bot) {
    res.status(404);
    throw new Error('Bot 机器人不存在');
  }

  const botObj = bot.toObject ? bot.toObject() : bot;

  // 有 tgUserId 时，根据机器人类型和用户身份过滤群组
  if (tgUserId) {
    // 获取 owner 的 Telegram ID
    let ownerId: string | undefined;
    if (bot.owner) {
      if (typeof bot.owner === 'object' && 'id' in bot.owner) {
        // bot.owner 是 populated IBotUser 对象
        ownerId = (bot.owner as any).id;
      } else {
        // bot.owner 是 ObjectId，无法获取 Telegram ID，跳过 owner 检查
        ownerId = undefined;
      }
    }

    // 如果是 Owner，显示所有群组（专属机器人）
    if (bot.type === 'private' && ownerId && ownerId === tgUserId) {
      // Owner 可以看所有群组，不过滤
    } else {
      // 非 Owner 或公共机器人：只显示该用户是 creator 或 operator 的群组
      (botObj as any).groups = (botObj.groups || []).filter((g: any) => {
        const creatorId =
          typeof g.creator === 'object' ? g.creator?.id : g.creator?.toString();
        const operatorIds = (g.operators || []).map((op: any) =>
          typeof op === 'object' ? op?.id : op?.toString(),
        );
        return creatorId === tgUserId || operatorIds.includes(tgUserId);
      });
    }
  }
  // 有 username 时，找到对应 BotUser._id，过滤群组
  else if (username) {
    const cleanUsername = username.replace(/^@/, '');
    const botUser = await BotUser.findOne({ userName: cleanUsername }).select(
      '_id groups',
    );
    if (botUser) {
      // 新逻辑：直接从 botUser.groups 获取用户所在的群组
      const userGroupIds = (botUser.groups || []).map((g) => g.toString());
      (botObj as any).groups = (botObj.groups || []).filter((g: any) =>
        userGroupIds.includes(g._id.toString()),
      );
    } else {
      (botObj as any).groups = [];
    }
  }

  // 处理 multi_image
  if (botObj.multi_image) {
    const signedUrl = await generateSignedUrl(botObj.multi_image);
    botObj.multi_image = signedUrl;
  }

  // 为每个群组添加成员数量统计
  if (botObj.groups && botObj.groups.length > 0) {
    const groupIds = botObj.groups.map((g: any) => g._id);

    // 统计每个群组的成员数量
    const memberCounts = await BotUser.aggregate([
      { $match: { groups: { $in: groupIds } } },
      { $unwind: '$groups' },
      { $match: { groups: { $in: groupIds } } },
      { $group: { _id: '$groups', count: { $sum: 1 } } },
    ]);

    // 创建成员数量映射
    const memberCountMap = memberCounts.reduce((acc: any, item: any) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    // 为每个群组添加成员数量
    botObj.groups = botObj.groups.map((group: any) => ({
      ...group,
      memberCount: memberCountMap[group._id.toString()] || 0,
    }));
  }

  res.json({
    success: true,
    data: botObj,
  });
});

const updateBot = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;
  const { private_key, token, proxy, ...updateData } = req.body;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const isSuperAdmin = req.user?.isAdmin;

  if (!isSuperAdmin) {
    delete (updateData as Record<string, unknown>).token;
  }

  // 如果提供了代理账号，将其赋值给bot.user
  if (proxy !== undefined) {
    (updateData as Record<string, unknown>).user = proxy;
  }

  const isTokenChanged = Boolean(
    isSuperAdmin && token !== undefined && token !== botManager.token,
  );

  if (isTokenChanged) {
    const botExists = await Bot.findOne({ token, _id: { $ne: id } });
    if (botExists) {
      res.status(400);
      throw new Error('该 Bot Token 已被其他机器人使用，请使用其他 Token');
    }

    try {
      const botInfo = await getBotInfoByToken(token);
      (updateData as Record<string, unknown>).id = botInfo.id;
      (updateData as Record<string, unknown>).botName =
        botInfo.botName || botManager.botName;
      (updateData as Record<string, unknown>).userName =
        botInfo.userName || botManager.userName;
      (updateData as Record<string, unknown>).token = token;
    } catch (error) {
      console.error('获取机器人信息失败:', error);
      res.status(400);
      throw new Error('token 无效或无法获取机器人信息');
    }

    try {
      const session = await startClientAndGetSession(token);
      (updateData as Record<string, unknown>).session = session as unknown;
    } catch (error) {
      console.error('获取 session 失败:', error);
    }
  }

  if (private_key) {
    (updateData as Record<string, unknown>).private_key = encrypt(private_key);
  }

  const updatedBot = await Bot.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedBot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  if (isTokenChanged && updatedBot.isOnline) {
    try {
      await setWebhook(updatedBot);
    } catch (e) {
      console.log('设置 webhook 失败:', e);
    }
  } else if (
    updatedBot.isOnline !== botManager.isOnline &&
    updatedBot.isOnline
  ) {
    await setWebhook(updatedBot);
  }

  const botObj = updatedBot.toObject ? updatedBot.toObject() : updatedBot;

  res.json({
    success: true,
    data: botObj,
  });
});

const deleteBot = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;

  // 1. 先查找机器人（不删除）
  const bot = await Bot.findById(id);

  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 2. 检查机器人是否属于当前用户
  // if (bot.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
  //   res.status(403);
  //   throw new Error('您无权删除此机器人');
  // }

  // 3. 删除机器人（当前机器人数量从数据库动态查询，无需更新）
  await Bot.findByIdAndDelete(id);

  console.log(`✅ 机器人删除成功，用户 ${req.user.name}`);

  res.json({
    success: true,
    data: { message: '机器人删除成功' },
  });
});

const deleteMultipleBots = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的机器人 ID');
    }

    // 1. 查找所有机器人
    const bots = await Bot.find({ _id: { $in: ids } });

    if (bots.length === 0) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    // 2. 检查所有机器人是否都属于当前用户
    // const unauthorizedBots = bots.filter(
    //   (bot) => bot.user.toString() !== req.user._id.toString(),
    // );

    // if (unauthorizedBots.length > 0 && !req.user.isAdmin) {
    //   res.status(403);
    //   throw new Error('您无权删除部分机器人');
    // }

    // 3. 删除机器人（当前机器人数量从数据库动态查询，无需更新）
    const botIds = bots.map((bot) => bot._id);
    await Bot.deleteMany({
      _id: { $in: botIds },
    });

    console.log(
      `✅ 批量删除成功，用户 ${req.user.name} 删除了 ${bots.length} 个机器人`,
    );

    res.json({
      success: true,
      message: `成功删除 ${bots.length} 个机器人`,
    });
  },
);

const addOwner = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const botManager = await Bot.findById(id);
  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const ownerUsername = req.body.owner.replace(/^@/, '');
  const user = await getUserByUsername(botManager.session, ownerUsername);

  if (!user) {
    res.status(404);
    throw new Error('用户在电报上不存在');
  }

  const botUser = await BotUser.findOneAndUpdate(
    { id: user.id.toString() },
    {
      $set: {
        userName: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    },
    { new: true, upsert: true },
  );

  await Bot.findByIdAndUpdate(
    id,
    { $addToSet: { botUsers: botUser._id }, $set: { owner: botUser._id } },
    { new: true },
  );

  res.json({ success: true });
});

const delOwner = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const botManager = await Bot.findById(id);
  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  await Bot.findByIdAndUpdate(id, { $unset: { owner: '' } }, { new: true });

  res.json({ success: true });
});

const addAuthorizer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 一定是字符串的，去掉 req.body.authorizer 前面的 @（如果有）
  const authorizerUsername = req.body.authorizer.replace(/^@/, '');
  const user = await getUserByUsername(botManager.session, authorizerUsername);

  if (user) {
    // 查找或创建 BotUser，并填充 subscriptions 字段
    const botUser = await BotUser.findOneAndUpdate(
      { id: user.id.toString() },
      {
        $set: {
          userName: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      },
      { new: true, upsert: true },
    ).populate('subscriptions');

    // 同时将当前用户添加到机器人的用户列表和授权用户列表中
    await Bot.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          botUsers: botUser._id,
          authorized_users: botUser._id,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
  } else {
    res.status(404);
    throw new Error('用户在电报上不存在');
  }

  res.json({
    success: true,
  });
});

const delAuthorizer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { authorizer } = req.body;
  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const botUser = await BotUser.findById(authorizer);

  if (!botUser) {
    res.status(404);
    throw new Error('用户不存在');
  }

  await Bot.findByIdAndUpdate(
    id,
    {
      $pull: { authorized_users: authorizer },
    },
    { new: true },
  );

  res.json({
    success: true,
  });
});

// send message
const sendMessage = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;
  const { message, menus, menus_per_row, intervalTime, send_type, images } =
    req.body;

  console.log('req.body', req.body);

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 查找所有与该机器人相关的用户（通过 BotUser.groups 中包含该机器人的群组）
  const botGroups = await Group.find({ bot: id }).select('_id');
  const groupIds = botGroups.map((g) => g._id);
  const botUsers = await BotUser.find({
    groups: { $in: groupIds },
  }).select('id userName firstName lastName');

  const telegramBot = setupBot(botManager.token);

  // 构建菜单按钮（InlineKeyboard）
  const replyMarkup = buildInlineKeyboard(menus, menus_per_row);

  const results = await Promise.allSettled(
    botUsers.map(async (botUser: any) => {
      try {
        // 支持图片发送
        if (images && Array.isArray(images) && images.length > 0) {
          await sendMediaMessage(telegramBot.api, botUser.id, images, {
            caption: message,
            reply_markup: replyMarkup,
          });
        } else {
          // 纯文本消息
          await telegramBot.api.sendMessage(botUser.id, message, {
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
        }
        return { userId: botUser.id, success: true };
      } catch (error: any) {
        return {
          userId: botUser.id,
          success: false,
          error: error.message,
        };
      }
    }),
  );

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && (r.value as any).success,
  ).length;
  const failed = results.filter(
    (r) => r.status === 'rejected' || !(r.value as any).success,
  ).length;

  if (send_type === 'scheduled') {
    await BotUserMessage.create({
      ...req.body,
      content: message,
      type: 'sent',
      bot: botManager,
      botUsers: botManager.botUsers,
      intervalTime,
      menus,
      proxy: req.proxyUser._id,
    });
  }

  res.json({
    success: true,
    data: {
      message: `消息发送完成：${successful} 个成功，${failed} 个失败`,
      details: results,
    },
  });
});

// group message
// send message
const sendGroupMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const { content, medias, menus, isPinned } = req.body;

    const botManager = await Bot.findById(id).populate('groups');

    const bot_groups = botManager.groups;

    const req_groups = req.body.groups;

    if (req_groups.length === 0) {
      res.status(400);
      throw new Error('群组列表不能为空，请选择群组');
    }

    // 从bot_groups中找到req_groups中存在的group
    const processed_groups = bot_groups.filter((group: any) =>
      req_groups.includes(String(group._id)),
    );

    if (!botManager) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const telegramBot = setupBot(botManager.token);

    // 先保存 GroupMessage 记录，获取真实的 menu._id 用于 callback_data
    let menusWithIds = menus;
    if (
      Array.isArray(menus) &&
      menus.some((m: any) => m?.type === 'callback')
    ) {
      try {
        const saved = await GroupMessage.create({
          ...req.body,
          bot: id,
          proxy: req.user?._id,
          sendType: 'immediate',
          isRealtime: true,
        });
        menusWithIds = saved.menus;
      } catch (e) {
        // 保存失败不影响发送，降级用原始 menus
      }
    }

    // 构建菜单 InlineKeyboard
    const replyMarkup = buildInlineKeyboard(menusWithIds);

    // 保证catch时跳过，不影响其它的
    await Promise.all(
      processed_groups.map(async (group: any) => {
        try {
          if (!group) {
            console.log(`[sendGroupMessage] 群组不存在: ${group}`);
            return;
          }

          let sentMessageId: number;

          if (medias && Array.isArray(medias) && medias.length > 0) {
            const result = await sendMediaMessage(
              telegramBot.api,
              group.id,
              medias,
              {
                caption: content,
                reply_markup: replyMarkup,
              },
            );
            sentMessageId =
              (result as any).message_id ||
              (result as any).media_group_messages?.[0]?.message_id;
          } else {
            // 发送纯文本消息
            const result = await telegramBot.api.sendMessage(
              group.id,
              content,
              {
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
              },
            );
            sentMessageId = result.message_id;
          }

          // 如果设置了置顶，则置顶消息
          if (isPinned && sentMessageId) {
            try {
              await telegramBot.api.pinChatMessage(group.id, sentMessageId, {
                disable_notification: true, // 静默置顶，不通知群成员
              });
              console.log(
                `[pinMessage] 群 ${group.id} 消息 ${sentMessageId} 已置顶`,
              );
            } catch (pinErr: any) {
              console.warn(
                `[pinMessage] 置顶消息失败（忽略）:`,
                pinErr?.message,
              );
            }
          }
        } catch (error) {
          // 捕获错误，输出日志，跳过本次，不影响其它群组
          console.error(
            `[sendGroupMessage] 向群组 ${group?.id} 发送消息失败:`,
            error,
          );
          // 直接return跳过
          return;
        }
      }),
    );

    res.json({
      success: true,
      message: '群发消息成功',
    });
  },
);

/**
 * 立即发送频道消息
 */
const sendChannelPost = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const { channelId, title, content, medias, menus, isPinned } = req.body;

    console.log('channel', channelId);

    const botManager = await Bot.findById(id);

    if (!botManager) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const channel = await Group.findById(channelId);

    // 获取目标频道 ID（可能是字符串或对象）
    const channelTarget = channel.id;

    if (!channelTarget) {
      res.status(400);
      throw new Error('请选择频道');
    }

    const telegramBot = setupBot(botManager.token);

    // 先保存 ChannelPost 记录，获取真实的 menu._id 用于 callback_data
    let menusWithIds = menus;
    if (
      Array.isArray(menus) &&
      menus.some((m: any) => m?.type === 'callback')
    ) {
      try {
        const saved = await ChannelPost.create({
          ...req.body,
          bot: id,
          proxy: req.proxyUser?._id,
          sendType: 'immediate',
          isOnline: false,
        });
        menusWithIds = saved.menus;
      } catch (e) {
        // 保存失败不影响发送，降级用原始 menus
      }
    }

    // 构建消息内容
    let messageContent = title ? `<b>${title}</b>` : '';
    if (content) {
      messageContent += messageContent ? `\n\n${content}` : content;
    }

    // 构建菜单 InlineKeyboard
    const replyMarkup = buildInlineKeyboard(menusWithIds);

    try {
      let sentMessageId: number;

      if (medias && Array.isArray(medias) && medias.length > 0) {
        const result = await sendMediaMessage(
          telegramBot.api,
          channelTarget,
          medias,
          {
            caption: messageContent,
            reply_markup: replyMarkup,
          },
        );
        sentMessageId =
          (result as any).message_id ||
          (result as any).media_group_messages?.[0]?.message_id;
      } else {
        // 发送纯文本消息
        const result = await telegramBot.api.sendMessage(
          channelTarget,
          messageContent,
          {
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          },
        );
        sentMessageId = result.message_id;
      }

      // 如果设置了置顶，则置顶消息
      if (isPinned && sentMessageId) {
        try {
          await telegramBot.api.pinChatMessage(channelTarget, sentMessageId, {
            disable_notification: true, // 静默置顶，不通知频道订阅者
          });
          console.log(
            `[pinMessage] 频道 ${channelTarget} 消息 ${sentMessageId} 已置顶`,
          );
        } catch (pinErr: any) {
          console.warn(`[pinMessage] 置顶消息失败（忽略）:`, pinErr?.message);
        }
      }

      res.json({
        success: true,
        message: '频道消息发送成功',
      });
    } catch (error) {
      console.error(
        `[sendChannelPost] 发送到频道 ${channelTarget} 失败:`,
        error,
      );
      res.status(500);
      throw new Error('频道消息发送失败');
    }
  },
);

/**
 * 内部接口：触发指定 Bot 设置 Webhook（供 bot 内部调用，不需鉴权）
 */
const triggerSetWebhook = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const bot = await Bot.findById(id);
  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }
  await setWebhook(bot);
  res.json({ success: true });
});

export {
  getBots,
  addBot,
  getBotById,
  updateBot,
  deleteBot,
  deleteMultipleBots,
  addOwner,
  delOwner,
  addAuthorizer,
  delAuthorizer,
  sendMessage,
  sendGroupMessage,
  sendChannelPost,
  triggerSetWebhook,
};
