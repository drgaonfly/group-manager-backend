import { Request, Response } from 'express';
import Bot, { IBot } from '../models/bot';
import handleAsync from '../utils/handleAsync';
import User from '../models/user';
import BotUser from '../models/botUser';
import { printWebhookInfo, setupBot } from '../bot/botSetup';
import { RequestCustom } from 'user';
import { isProxy, isEmployee } from '../middlewares/authMiddleware';
import { getUserByUsername } from '../bot/commands/user/operator/add';
import { encrypt } from '../services/encrypt';
import dotenv from 'dotenv';
import { InputFile } from 'grammy';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { transformDocumentImage } from '../utils/transformUtils';
import { InlineKeyboard } from 'grammy';
import BotUserMessage from '../models/botUserMessage';

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

  if (queryParams.isOnline !== '') {
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
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.user = { $in: [...employeeIds, req.user._id] };
  }

  if (isEmployee(req.user)) {
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
    .sort('-createdAt')
    .select('-private_key')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .lean()
    .exec();

  const botsWithSignedUrls = await Promise.all(
    bots.map(async (bot) => {
      if (bot.multi_image) {
        const signedUrl = await generateSignedUrl(bot.multi_image);
        return { ...bot, multi_image: signedUrl };
      }
      return bot;
    }),
  );

  const total = await Bot.countDocuments(query).exec();

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

  await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${botManager._id}`);

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
  const { token, isOnline } = req.body;

  const botExists = await Bot.findOne({ token });

  if (botExists) {
    res.status(400);
    throw new Error('该 Bot Token 已被使用，请使用其他 Token');
  }

  const botManager = new Bot({
    ...req.body,
    user: req.user._id,
  });

  if (isOnline) {
    try {
      setWebhook(botManager);
    } catch (e) {
      console.log(e);
      throw new Error('token 无效');
    }
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
  // 如果 multi_image 是空字符串或者是一个新的文件路径（不以http开头），则更新它。
  // 如果是已存在的URL（以http开头），则不更新，因为它已经在数据库中。
  if (multi_image === '' || (multi_image && !multi_image.startsWith('http'))) {
    updates.multi_image = multi_image;
  }

  if (private_key) {
    updates.private_key = encrypt(private_key);
  }

  const updatedBot = await Bot.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (updatedBot.isOnline !== botManager.isOnline && updatedBot.isOnline) {
    await setWebhook(updatedBot);
  }

  // 处理 multi_image 路径
  const processedBot = await transformDocumentImage(updatedBot, [
    'multi_image',
  ]);

  res.json({
    success: true,
    data: processedBot,
  });
});

const deleteBot = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const bot = await Bot.findByIdAndDelete(id);

  if (!bot) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  res.json({
    success: true,
    data: { message: '机器人删除成功' },
  });
});

const deleteMultipleBots = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  const bots = await Bot.find({ _id: { $in: ids } });

  if (bots.length === 0) {
    res.status(404);
    throw new Error('机器人不存在');
  }

  // for (const botManager of bots) {
  //   const bot = setupBot(botManager.token);
  //   const webhookInfo = await printWebhookInfo(bot);
  //   if (webhookInfo.url) {
  //     await bot.api.deleteWebhook();
  //     console.log(`${botManager.userName} Webhook ${botManager.token} 已删除`);
  //   }
  // }

  const botIds = bots.map((bot) => bot._id);

  await Bot.deleteMany({
    _id: { $in: botIds },
  });

  res.json({
    success: true,
    message: `成功删除 ${ids.length} 个机器人`,
  });
});

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
const sendMessage = handleAsync(async (req: Request, res: Response) => {
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
  let replyMarkup: InlineKeyboard | undefined = undefined;
  if (Array.isArray(menus) && menus.length > 0) {
    replyMarkup = new InlineKeyboard();

    for (let i = 0; i < menus.length; i += menus_per_row) {
      const row = menus.slice(i, i + menus_per_row);
      const buttons = row
        .filter((menu: any) => menu.menuName && menu.url)
        .map((menu: any) => ({
          text: menu.menuName,
          url: menu.url,
        }));

      if (buttons.length > 0) {
        replyMarkup.add(...buttons).row();
      }
    }
  }

  const results = await Promise.allSettled(
    botManager.botUsers.map(async (botUser: any) => {
      try {
        // 支持图片发送
        if (images && Array.isArray(images) && images.length > 0) {
          if (images.length === 1) {
            // 单张图片，直接 sendPhoto
            await telegramBot.api.sendPhoto(
              botUser.id,
              new InputFile(`tmp/${images[0]}`),
              {
                caption: message,
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
              },
            );
          } else {
            // 多张图片，使用 sendMediaGroup
            const media = images.map((img: string, idx: number) => {
              return {
                type: 'photo' as const,
                media: new InputFile(`tmp/${img}`),
                ...(idx === 0
                  ? {
                      caption: message,
                      parse_mode: 'HTML',
                      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                    }
                  : {}),
              };
            });
            await telegramBot.api.sendMediaGroup(botUser.id, media as any);
          }
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

  const { content, images } = req.body;

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

  // 保证catch时跳过，不影响其它的
  await Promise.all(
    processed_groups.map(async (group: any) => {
      try {
        if (!group) {
          console.log(`[sendGroupMessage] 群组不存在: ${group}`);
          return;
        }

        if (images && Array.isArray(images) && images.length > 0) {
          if (images.length === 1) {
            // 单张图片，直接 sendPhoto
            await telegramBot.api.sendPhoto(
              group.id,
              new InputFile(`tmp/${images[0]}`),
              {
                caption: content,
                parse_mode: 'HTML',
              },
            );
          } else {
            // 多张图片，使用 sendMediaGroup
            const media = images.map((img: string, idx: number) => {
              return {
                type: 'photo' as const,
                media: new InputFile(`tmp/${img}`),
                ...(idx === 0 ? { caption: content, parse_mode: 'HTML' } : {}),
              };
            });
            await telegramBot.api.sendMediaGroup(group.id, media as any);
          }
        } else {
          await telegramBot.api.sendMessage(group.id, content, {
            parse_mode: 'HTML',
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
};
