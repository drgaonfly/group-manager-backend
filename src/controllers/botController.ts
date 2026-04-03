import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import Bot, { IBot } from '../models/bot';
import handleAsync from '../utils/handleAsync';
import User from '../models/user';
import BotUser from '../models/botUser';
import { printWebhookInfo, setupBot } from '../bot/botSetup';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import { getUserByUsername } from '../bot/commands/user/operator/add';
import { encrypt } from '../services/encrypt';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { transformDocumentImage } from '../utils/transformUtils';
import BotUserMessage from '../models/botUserMessage';
import GroupMessage from '../models/groupMessage';
import ChannelPost from '../models/channelPost';
import ReplyRule from '../models/replyRule';
import CheckinRule from '../models/checkInRule';
import Lottery from '../models/lottery';
import Teacher from '../models/teacher';
import Evaluation from '../models/evaluation';
import GroupMessageRecord from '../models/groupMessageRecord';
import ChannelPostHistory from '../models/channelPostHistory';
import LotteryParticipant from '../models/lotteryParticipant';
import { buildInlineKeyboard } from '../utils/buildInlineKeyboard';
import { sendMediaMessage } from '../utils/sendMultiMedia';
import { extractChannelTarget } from '../utils/extractChannelTarget';
import { getBotInfoWithGramjs } from '../utils/getBotInfoWithGramjs';
import GroupWelcome from '../models/groupWelcome';
import GroupVerify from '../models/groupVerify';

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

  // isExpired
  if (queryParams.isExpired) {
    query.isExpired = queryParams.isExpired === 'true';
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

  if (isProxy(req.user)) {
    query.user = req.user._id;
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
    .populate('botUsers')
    .populate('groups')
    .populate('owners')
    .populate('authorized_users')
    .populate('clonedFrom')
    .populate('creator')
    .populate('channel_posts')
    .populate('groupWelcome')
    .populate('groupVerify')
    .populate({
      path: 'teachers',
      populate: {
        path: 'botUser',
        select: 'id userName firstName lastName',
      },
    })
    .populate({
      path: 'botUserConfigs',
      populate: [
        {
          path: 'botUser',
          select: 'id userName firstName lastName',
        },
        {
          path: 'bot',
          select: 'botName userName',
        },
      ],
    })
    .sort('-createdAt')
    .select('-private_key')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const botsWithSignedUrls = await Promise.all(
    bots.map(async (bot) => {
      const botObj = bot.toObject ? bot.toObject() : bot;

      // 处理 multi_image
      if (botObj.multi_image) {
        const signedUrl = await generateSignedUrl(botObj.multi_image);
        botObj.multi_image = signedUrl;
      }

      // 处理 groupWelcome 中的 medias
      if (
        botObj.groupWelcome &&
        botObj.groupWelcome.medias &&
        Array.isArray(botObj.groupWelcome.medias)
      ) {
        const processedMedias = await Promise.all(
          botObj.groupWelcome.medias.map(async (mediaUrl: string) => {
            if (mediaUrl) {
              return await generateSignedUrl(mediaUrl);
            }
            return mediaUrl;
          }),
        );
        botObj.groupWelcome.medias = processedMedias;
      }

      return botObj;
    }),
  );

  const total = await Bot.countDocuments(query).exec();

  console.log('getBots result:', { total, botsCount: bots.length, query });

  res.json({
    success: true,
    data: botsWithSignedUrls,
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
  ] as const;

  await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${botManager._id}`, {
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
  const bot = await Bot.findById(req.params.id);

  if (!bot) {
    res.status(404);
    throw new Error('Bot 机器人不存在');
  }

  res.json({
    success: true,
    data: bot,
  });
});

const updateBot = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { private_key, multi_image, ...otherFields } = req.body;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 处理 multi_image 字段
  const updates: any = {
    ...otherFields,
  };

  // 显式处理 multi_image 字段
  if (multi_image === '' || (multi_image && !multi_image.startsWith('http'))) {
    updates.multi_image = multi_image;
  }

  if (private_key) {
    updates.private_key = encrypt(private_key);
  }

  const updatedBot = await Bot.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  })
    .populate('groupWelcome')
    .populate('groupVerify');

  if (updatedBot.isOnline !== botManager.isOnline && updatedBot.isOnline) {
    await setWebhook(updatedBot);
  }

  // 处理 multi_image 路径
  const processedBot = await transformDocumentImage(updatedBot, [
    'multi_image',
  ]);

  // 处理 groupWelcome 中的 medias
  const botObj = processedBot.toObject ? processedBot.toObject() : processedBot;
  if (
    botObj.groupWelcome &&
    botObj.groupWelcome.medias &&
    Array.isArray(botObj.groupWelcome.medias)
  ) {
    const processedMedias = await Promise.all(
      botObj.groupWelcome.medias.map(async (mediaUrl: string) => {
        if (mediaUrl) {
          return await generateSignedUrl(mediaUrl);
        }
        return mediaUrl;
      }),
    );
    botObj.groupWelcome.medias = processedMedias;
  }

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
  if (bot.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('您无权删除此机器人');
  }

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
    const unauthorizedBots = bots.filter(
      (bot) => bot.user.toString() !== req.user._id.toString(),
    );

    if (unauthorizedBots.length > 0) {
      res.status(403);
      throw new Error('您无权删除部分机器人');
    }

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

  // 一定是字符串的，去掉 req.body.owner 前面的 @（如果有）
  const ownerUsername = req.body.owner.replace(/^@/, '');
  const user = await getUserByUsername(botManager.session, ownerUsername);

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

    // 同时将当前用户添加到机器人的用户列表和 owners 列表中
    await Bot.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          botUsers: botUser._id,
          owners: botUser._id,
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

const delOwner = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { owner } = req.body;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const botUser = await BotUser.findById(owner);

  if (!botUser) {
    res.status(404);
    throw new Error('用户不存在');
  }

  await Bot.findByIdAndUpdate(
    id,
    {
      $pull: { owners: owner },
    },
    { new: true },
  );

  res.json({
    success: true,
  });
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

  const botManager = await Bot.findById(id).populate('botUsers');

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  const telegramBot = setupBot(botManager.token);

  // 构建菜单按钮（InlineKeyboard）
  const replyMarkup = buildInlineKeyboard(menus, menus_per_row);

  const results = await Promise.allSettled(
    botManager.botUsers.map(async (botUser: any) => {
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
      menus_per_row,
      proxy: req.user._id,
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
const sendGroupMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const { content, medias, menus, menus_per_row } = req.body;

  const botManager = await Bot.findById(id)
    .populate('botUsers')
    .populate('groups');

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

  // 构建菜单 InlineKeyboard
  const replyMarkup = buildInlineKeyboard(menus, menus_per_row);

  // 保证catch时跳过，不影响其它的
  await Promise.all(
    processed_groups.map(async (group: any) => {
      try {
        if (!group) {
          console.log(`[sendGroupMessage] 群组不存在: ${group}`);
          return;
        }

        if (medias && Array.isArray(medias) && medias.length > 0) {
          await sendMediaMessage(telegramBot.api, group.id, medias, {
            caption: content,
            reply_markup: replyMarkup,
          });
        } else {
          // 发送纯文本消息
          await telegramBot.api.sendMessage(group.id, content, {
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
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
});

/**
 * 立即发送频道消息
 */
const sendChannelPost = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, channels, title, content, medias, menus, menus_per_row } =
    req.body;

  const botManager = await Bot.findById(id).populate('groups');

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 获取目标频道列表
  const channelTargets: (string | number)[] = [];

  // 优先使用 channels 数组（新版本）
  if (channels && Array.isArray(channels) && channels.length > 0) {
    // channels 是 Group 的 _id 数组，需要从 bot.groups 中找到对应的 Telegram ID
    const botGroups = botManager.groups as any[];
    for (const channelId of channels) {
      const group = botGroups.find(
        (g: any) => g._id.toString() === channelId.toString(),
      );
      if (group && group.id) {
        channelTargets.push(group.id);
      }
    }
  } else if (url) {
    // 兼容旧版本：从频道URL中提取频道ID或用户名
    const channelTarget = extractChannelTarget(url);
    if (channelTarget) {
      channelTargets.push(channelTarget);
    }
  }

  if (channelTargets.length === 0) {
    res.status(400);
    throw new Error('请选择至少一个频道，或提供有效的频道链接');
  }

  const telegramBot = setupBot(botManager.token);

  // 构建消息内容
  let messageContent = title ? `<b>${title}</b>` : '';
  if (content) {
    messageContent += messageContent ? `\n\n${content}` : content;
  }

  // 构建内联键盘
  const replyMarkup = buildInlineKeyboard(menus, menus_per_row);

  try {
    // 向每个频道发送消息
    const results: {
      channel: string | number;
      success: boolean;
      error?: string;
    }[] = [];

    for (const channelTarget of channelTargets) {
      try {
        // 发送消息到频道
        if (medias && Array.isArray(medias) && medias.length > 0) {
          await sendMediaMessage(telegramBot.api, channelTarget, medias, {
            caption: messageContent,
            reply_markup: replyMarkup,
          });
        } else {
          // 发送纯文本消息
          await telegramBot.api.sendMessage(channelTarget, messageContent, {
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
        }

        results.push({ channel: channelTarget, success: true });
      } catch (sendError: any) {
        console.error(
          `[sendChannelPost] 发送到频道 ${channelTarget} 失败:`,
          sendError,
        );
        results.push({
          channel: channelTarget,
          success: false,
          error: sendError?.description || sendError?.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (successCount === 0) {
      res.status(500);
      throw new Error('所有频道发送失败');
    }

    res.json({
      success: true,
      message:
        failCount > 0
          ? `频道消息发送完成，成功 ${successCount} 个，失败 ${failCount} 个`
          : '频道消息发送成功',
      results,
    });
  } catch (error: any) {
    console.error('[sendChannelPost] 发送频道消息失败:', error);
    res.status(500);
    throw new Error(error?.description || error?.message || '发送频道消息失败');
  }
});

/**
 * 更新群欢迎配置
 */
const updateGroupWelcome = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // 只提取有效字段，避免传入非法数据；过滤掉 name/url 为空的 menu 项
  const rawMenus = Array.isArray(body.menus) ? body.menus : [];
  const validMenus = rawMenus.filter(
    (m: any) =>
      m &&
      typeof m.name === 'string' &&
      typeof m.url === 'string' &&
      m.name.trim() &&
      m.url.trim(),
  );
  const groupWelcomeData = {
    contents: Array.isArray(body.contents) ? body.contents : [],
    caption: body.caption ?? '',
    medias: Array.isArray(body.medias) ? body.medias : [],
    menus: validMenus,
    deleteAfterSeconds:
      typeof body.deleteAfterSeconds === 'number' ? body.deleteAfterSeconds : 0,
  };

  if (botManager.groupWelcome) {
    // 更新现有的 GroupWelcome，使用 $set 确保正确更新
    await GroupWelcome.findByIdAndUpdate(
      botManager.groupWelcome,
      { $set: groupWelcomeData },
      { new: true, runValidators: true },
    );
  } else {
    // 创建新的 GroupWelcome
    const newGroupWelcome = await GroupWelcome.create(groupWelcomeData);
    // 使用 findByIdAndUpdate 避免 save() 触发完整文档验证导致的 options 未定义错误
    await Bot.findByIdAndUpdate(id, {
      $set: { groupWelcome: newGroupWelcome._id },
    });
  }

  // 重新查询完整的 bot 数据，包括 populate
  const updatedBot = await Bot.findById(id)
    .populate('groupWelcome')
    .populate('groupVerify');

  // 处理 groupWelcome 中的 medias
  const botObj = updatedBot!.toObject ? updatedBot!.toObject() : updatedBot;
  if (
    botObj.groupWelcome &&
    botObj.groupWelcome.medias &&
    Array.isArray(botObj.groupWelcome.medias)
  ) {
    const processedMedias = await Promise.all(
      botObj.groupWelcome.medias.map(async (mediaUrl: string) => {
        if (mediaUrl) {
          return await generateSignedUrl(mediaUrl);
        }
        return mediaUrl;
      }),
    );
    botObj.groupWelcome.medias = processedMedias;
  }

  res.json({
    success: true,
    data: botObj,
    message: '群欢迎配置更新成功',
  });
});

/**
 * 更新群验证配置
 */
const updateGroupVerify = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const groupVerifyData = req.body;

  const botManager = await Bot.findById(id);

  if (!botManager) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  if (botManager.groupVerify) {
    // 更新现有的 GroupVerify

    await GroupVerify.findByIdAndUpdate(
      botManager.groupVerify,
      groupVerifyData,
      { new: true, runValidators: true },
    );
  } else {
    // 创建新的 GroupVerify
    const newGroupVerify = await GroupVerify.create(groupVerifyData);
    // 使用 findByIdAndUpdate 避免 save() 触发完整文档验证导致的 options 未定义错误
    await Bot.findByIdAndUpdate(id, {
      $set: { groupVerify: newGroupVerify._id },
    });
  }

  // 重新查询完整的 bot 数据，包括 populate
  const updatedBot = await Bot.findById(id)
    .populate('groupWelcome')
    .populate('groupVerify');

  res.json({
    success: true,
    data: updatedBot,
    message: '群验证配置更新成功',
  });
});

const BOT_FEATURE_FIELD_KEYS: string[] = [
  'message',
  'menus',
  'keyboards',
  'presets',
  'intervalTime',
  'minSpeechLength',
  'allowPureNumberSpeech',
  'balanceClearedAt',
  'canSpeechStatic',
  'canFreeKeyboard',
  'canGroupMessaging',
  'canBidirectional',
  'canGroupWelcome',
  'canOpenChannelPost',
  'canGroupVerify',
  'canReportMemberNameUpdated',
  'canReplyRule',
  'canCheckIn',
  'canLotteryRule',
  'canTeaching',
  'multi_image',
  'multi_content',
  'fee',
  'auto_exchange_address',
  'exchange_rate',
];

function omitDocMeta<T extends Record<string, unknown>>(doc: T) {
  const rest = { ...(doc as Record<string, unknown>) };
  delete rest._id;
  delete rest.__v;
  delete rest.createdAt;
  delete rest.updatedAt;
  return rest as Omit<T, '_id' | '__v' | 'createdAt' | 'updatedAt'>;
}

async function cloneGroupWelcomeDoc(
  refId: mongoose.Types.ObjectId | string | undefined | null,
): Promise<mongoose.Types.ObjectId | null> {
  if (!refId) return null;
  const doc = await GroupWelcome.findById(refId).lean();
  if (!doc) return null;
  const [created] = await GroupWelcome.create([
    omitDocMeta(doc as Record<string, unknown>),
  ]);
  return created._id;
}

async function cloneGroupVerifyDoc(
  refId: mongoose.Types.ObjectId | string | undefined | null,
): Promise<mongoose.Types.ObjectId | null> {
  if (!refId) return null;
  const doc = await GroupVerify.findById(refId).lean();
  if (!doc) return null;
  const [created] = await GroupVerify.create([
    omitDocMeta(doc as Record<string, unknown>),
  ]);
  return created._id;
}

async function newLotteryCode(): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const code = randomBytes(8).toString('hex');
    const dup = await Lottery.findOne({ code }).select('_id').lean();
    if (!dup) return code;
  }
  throw new Error('无法生成唯一抽奖码');
}

/**
 * 超级管理员：将源机器人的功能配置复制到目标机器人（覆盖目标侧同类配置）。
 * 群发/频道推广中的群组、频道绑定会清空，需在目标机器人上重新选择。
 * 不使用 MongoDB 事务，以便在单机（非副本集）环境下可用；副本集部署下亦为顺序执行。
 */
const copyBotFeatureConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { sourceBotId, targetBotId } = req.body as {
      sourceBotId?: string;
      targetBotId?: string;
    };

    if (!sourceBotId || !targetBotId) {
      res.status(400);
      throw new Error('请提供 sourceBotId 与 targetBotId');
    }

    if (String(sourceBotId) === String(targetBotId)) {
      res.status(400);
      throw new Error('源机器人与目标机器人不能相同');
    }

    const sourceBot = await Bot.findById(sourceBotId).lean();
    const targetBot = await Bot.findById(targetBotId).lean();

    if (!sourceBot || !targetBot) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const oldTargetGw = targetBot.groupWelcome;
    const oldTargetGv = targetBot.groupVerify;

    const newGroupWelcomeId = await cloneGroupWelcomeDoc(
      sourceBot.groupWelcome as unknown as
        | mongoose.Types.ObjectId
        | string
        | undefined,
    );
    const newGroupVerifyId = await cloneGroupVerifyDoc(
      sourceBot.groupVerify as unknown as
        | mongoose.Types.ObjectId
        | string
        | undefined,
    );

    const featureUpdate: Record<string, unknown> = {
      groupWelcome: newGroupWelcomeId,
      groupVerify: newGroupVerifyId,
    };

    for (const key of BOT_FEATURE_FIELD_KEYS) {
      const v = (sourceBot as Record<string, unknown>)[key as string];
      if (v !== undefined) {
        featureUpdate[key as string] = v;
      }
    }

    const targetLotteryIds = (
      await Lottery.find({ bot: targetBotId }).select('_id').lean()
    ).map((l) => l._id);
    if (targetLotteryIds.length > 0) {
      await LotteryParticipant.deleteMany({
        lottery: { $in: targetLotteryIds },
      });
    }
    await Lottery.deleteMany({ bot: targetBotId });

    await GroupMessageRecord.deleteMany({ bot: targetBotId });
    await GroupMessage.deleteMany({ bot: targetBotId });

    await ChannelPostHistory.deleteMany({ bot: targetBotId });
    await ChannelPost.deleteMany({ bot: targetBotId });

    await ReplyRule.deleteMany({ bot: targetBotId });
    await CheckinRule.deleteMany({ bot: targetBotId });
    await BotUserMessage.deleteMany({ bot: targetBotId });

    await Evaluation.deleteMany({ bot: targetBotId });
    await Teacher.deleteMany({ bot: targetBotId });

    const proxyId = targetBot.user;

    const groupMessages = await GroupMessage.find({ bot: sourceBotId }).lean();
    if (groupMessages.length > 0) {
      await GroupMessage.insertMany(
        groupMessages.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
          groups: [],
        })),
      );
    }

    const channelPosts = await ChannelPost.find({ bot: sourceBotId }).lean();
    if (channelPosts.length > 0) {
      await ChannelPost.insertMany(
        channelPosts.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
          channel: undefined,
          channels: [],
          lastPostTime: undefined,
          lastPostMessageId: undefined,
        })),
      );
    }

    const replyRules = await ReplyRule.find({ bot: sourceBotId }).lean();
    if (replyRules.length > 0) {
      await ReplyRule.insertMany(
        replyRules.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
        })),
      );
    }

    const checkinRules = await CheckinRule.find({ bot: sourceBotId }).lean();
    if (checkinRules.length > 0) {
      await CheckinRule.insertMany(
        checkinRules.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
        })),
      );
    }

    const lotteries = await Lottery.find({ bot: sourceBotId }).lean();
    for (const row of lotteries) {
      const code = await newLotteryCode();
      const body = omitDocMeta(row as Record<string, unknown>);
      await Lottery.create([
        {
          ...body,
          bot: targetBotId,
          proxy: proxyId,
          code,
          status: 'pending',
          drawnAt: undefined,
        },
      ]);
    }

    const botUserMessages = await BotUserMessage.find({
      bot: sourceBotId,
    }).lean();
    if (botUserMessages.length > 0) {
      await BotUserMessage.insertMany(
        botUserMessages.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
        })),
      );
    }

    const teachers = await Teacher.find({ bot: sourceBotId }).lean();
    if (teachers.length > 0) {
      await Teacher.insertMany(
        teachers.map((row) => ({
          ...omitDocMeta(row as Record<string, unknown>),
          bot: targetBotId,
          proxy: proxyId,
        })),
      );
    }

    await Bot.findByIdAndUpdate(targetBotId, { $set: featureUpdate });

    if (oldTargetGw && String(oldTargetGw) !== String(newGroupWelcomeId)) {
      await GroupWelcome.deleteOne({ _id: oldTargetGw });
    }
    if (oldTargetGv && String(oldTargetGv) !== String(newGroupVerifyId)) {
      await GroupVerify.deleteOne({ _id: oldTargetGv });
    }

    const updatedBot = await Bot.findById(targetBotId)
      .populate('groupWelcome')
      .populate('groupVerify');

    const processedBot = await transformDocumentImage(updatedBot!, [
      'multi_image',
    ]);
    const botObj = processedBot.toObject
      ? processedBot.toObject()
      : processedBot;

    res.json({
      success: true,
      data: botObj,
      message: '功能配置已复制到目标机器人',
    });
  },
);

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
  updateGroupWelcome,
  updateGroupVerify,
  copyBotFeatureConfig,
};
