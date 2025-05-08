import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../types';
import BotUser from '../../../models/botUser';
import Bot, { IMenu } from '../../../models/bot';
import User from '../../../models/user';
import createDebug from 'debug';
import Transaction from '../../../models/transaction';
import { IdGen } from '../../../utils/idGen';
import { useSummary } from '../../../utils/useEjsMessage';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:error');

const handleTransactionCommand = async (
  ctx: MyContext,
  type: '+' | '-' | '入款' | '下发' | '下发-',
) => {
  const [, , amount, rate, userRaw, feeRate] = ctx.match!;
  const isDeposit = type === '+' || type === '入款' || type === '下发-';

  const user = await User.findOne({
    firstName: ctx.update.message.from.first_name,
    lastName: ctx.update.message.from.last_name,
  });

  const toUser =
    (await User.findOne({
      name: userRaw?.startsWith('@') ? userRaw.slice(1) : userRaw,
    })) || null;

  const bot = await Bot.findOneAndUpdate({
    token: ctx.api.token,
    isOnline: true,
  });

  let existingBotUser = await BotUser.findOne({
    id: ctx.update.message.from.id.toString(),
  });

  if (!existingBotUser) {
    existingBotUser = new BotUser({
      id: await IdGen.next(BotUser, 'id', 6),
      bot,
      user,
      userName:
        ctx.update.message.from.last_name + ctx.update.message.from.first_name,
      firstName: ctx.update.message.from.first_name,
      lastName: ctx.update.message.from.last_name,
      fee_rate: feeRate || 0,
      exchange_rate: rate || process.env.DEFAULT_EXCHANGE_RATE,
    });

    await existingBotUser.save();
  }

  if (isDeposit) {
    const transaction = new Transaction({
      id: await IdGen.next(Transaction, 'id', 6),
      bot,
      amount: Number(amount),
      exchange_rate: existingBotUser.exchange_rate || 1,
      fee_rate: existingBotUser.fee_rate || 0,
      to_user: toUser,
      type: 'deposit',
    });

    await transaction.save();
  } else {
    const existing = await Transaction.findOne({ bot, to_user: toUser });

    if (!existing) {
      await ctx.reply(`未找到对应的入款记录，无法执行减款`);
      return;
    }

    const transaction = new Transaction({
      id: await IdGen.next(Transaction, 'id', 6),
      bot,
      amount: Number(amount),
      exchange_rate: existingBotUser.exchange_rate,
      fee_rate: existingBotUser.fee_rate,
      to_user: toUser,
      type: 'withdraw',
    });

    await transaction.save();
  }

  const renderSummary = useSummary();

  const [depositTimes, withdrawTimes, totalDeposits, totalWithdraws] =
    await Promise.all([
      Transaction.countDocuments({ bot, to_user: toUser, type: 'deposit' }),
      Transaction.countDocuments({ bot, to_user: toUser, type: 'withdraw' }),
      Transaction.find({ bot, to_user: toUser, type: 'deposit' }),
      Transaction.find({ bot, to_user: toUser, type: 'withdraw' }),
    ]);

  const message = await renderSummary({
    title: '记账机器人',
    depositTimes,
    widthdrawTimes: withdrawTimes,
    deposits: totalDeposits,
    widthdraws: totalWithdraws,
    feeRate: existingBotUser.fee_rate,
    exchangeRate: existingBotUser.exchange_rate,
  });

  await ctx.reply(message, { parse_mode: 'HTML' });
};

// 开始命令处理
startCommand.command('start', async (ctx) => {
  debug('start');
  const token = ctx.api.token;

  const bot = await Bot.findOne({ token, isOnline: true });

  if (!bot) {
    console.log('机器人已离线');
    await ctx.reply('机器人已离线');
    return;
  }

  bot.userName = ctx.me?.username || bot.userName;
  bot.botName = ctx.me?.first_name || bot.botName;
  bot.id = ctx.me?.id || bot.id;

  await bot.save();
  console.log('Bot信息已更新');
  console.log(bot);

  console.log('form_info', ctx.from);

  const id = ctx.from?.id?.toString();
  const userName = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  console.log('form_info', ctx);

  const user = await User.findById(bot.user);

  // 检查数据库中是否已存在该用户ID
  const botUser = await BotUser.findOneAndUpdate(
    { id },
    {
      $set: {
        userName,
        firstName,
        lastName,
        bot: bot._id,
        user: user._id,
      },
    },
    { new: true, upsert: true },
  );

  console.log(`已${botUser.isNew ? '添加' : '更新'}用户: ${botUser}`);

  // 发送长文本消息并附带 Inline Menu
  await ctx.reply(bot.message || '欢迎使用机器人', {
    reply_markup: setMenu(bot.menus),
  });
});

// 处理"开始"命令 - 激活机器人并开始记录
startCommand.hears(/^开始$/, async (ctx) => {
  // 检查用户权限
  // 更新机器人状态为激活
  await ctx.reply('机器人已激活，开始记录账务');
});

// 处理"停止"命令 - 暂停机器人记录
startCommand.hears(/^停止$/, async (ctx) => {
  // 检查用户权限
  // 更新机器人状态为暂停
  await ctx.reply('机器人已暂停记录');
});

// 处理"上课"命令 - 开始营业，全员开启发送消息权限
startCommand.hears(/^上课$/, async (ctx) => {
  // 检查用户权限
  // 更新群组权限
  await ctx.reply('已开始营业，全员可发送消息');
});

// 处理"下课"命令 - 停止营业，全员禁止发送消息
startCommand.hears(/^下课$/, async (ctx) => {
  // 检查用户权限
  // 更新群组权限
  await ctx.reply('已停止营业，全员禁止发送消息');
});

// 处理添加操作员命令
startCommand.hears(/^添加操作员\s+(.+)$/, async (ctx) => {
  // 检查用户权限
  // 解析@用户名并添加操作员
  await ctx.reply('操作员添加成功');
});

// 处理删除操作员命令
startCommand.hears(/^删除操作员\s+(.+)$/, async (ctx) => {
  // 检查用户权限
  // 解析@用户名并删除操作员
  await ctx.reply('操作员删除成功');
});

// 处理设置费率命令
startCommand.hears(/^设置费率(\d+)(%)?$/, async (ctx) => {
  // 检查用户权限
  // 设置费率
  const rate = ctx.match[1];
  await ctx.reply(`费率已设置为${rate}%`);
});

// 处理设置汇率命令
startCommand.hears(/^设置汇率(\d+\.?\d*)$/, async (ctx) => {
  // 检查用户权限
  // 设置汇率
  const exchangeRate = ctx.match[1];

  console.log('ctx', ctx.update.message);

  await BotUser.findOneAndUpdate(
    {
      id: ctx.update.message.from.id.toString(),
    },
    {
      exchange_rate: exchangeRate,
    },
  );

  await ctx.reply(`汇率已设置为${exchangeRate}`);
});

// +100 /1.1 @user 0.03
startCommand.hears(
  /^([+-])(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s+(@?\S+))?(?:\s+(\d+(?:\.\d+)?))?$/,
  async (ctx) => {
    await handleTransactionCommand(ctx, ctx.match![1] as '+' | '-');
  },
);

// 入款100 /1.1 @user 0.03
startCommand.hears(
  /^(入款)(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s+(@?\S+))?(?:\s+(\d+(?:\.\d+)?))?$/,
  async (ctx) => {
    await handleTransactionCommand(ctx, '入款');
  },
);

// 下发100 /1.1 @user 0.03
startCommand.hears(
  /^(下发)(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s+(@?\S+))?(?:\s+(\d+(?:\.\d+)?))?$/,
  async (ctx) => {
    await handleTransactionCommand(ctx, '下发');
  },
);

// 下发-100 /1.1 @user 0.03
startCommand.hears(
  /^(下发-)(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s+(@?\S+))?(?:\s+(\d+(?:\.\d+)?))?$/,
  async (ctx) => {
    await handleTransactionCommand(ctx, '下发-');
  },
);

// 处理显示账单命令
startCommand.hears(/^显示账单$/, async (ctx) => {
  // 生成并显示账单
  await ctx.reply('今日账单已生成，请点击链接查看完整账单');
});

// 处理清除账单命令
startCommand.hears(/^清除(今日|全部)账单$/, async (ctx) => {
  // 清除账单
  const type = ctx.match[1];
  await ctx.reply(`${type}账单已清除`);
});

// 处理OTC查询命令
startCommand.hears(/^(OTC|币价|Z0)$/, async (ctx) => {
  // 查询OTC价格
  await ctx.reply('OTC价格查询结果');
});

// 处理显示模式命令
startCommand.hears(/^简洁模式(\d+)$/, async (ctx) => {
  // 设置简洁模式
  const limit = ctx.match[1];
  await ctx.reply(`已设置简洁模式，显示${limit}条记录`);
});

startCommand.hears(/^完整模式$/, async (ctx) => {
  // 设置完整模式
  await ctx.reply('已设置完整模式，显示全部记录');
});

const setMenu = (menu: IMenu[]) => {
  const inlineMenu = new InlineKeyboard();

  menu.forEach((item) => {
    inlineMenu.url(item.menuName, item.url).row();
  });

  return inlineMenu;
};

export default startCommand;

// 处理机器人被添加到群组的事件
startCommand.on('my_chat_member', async (ctx) => {
  const chatMember = ctx.myChatMember;

  // 检查是否是被添加到群组
  if (
    chatMember.chat.type === 'group' ||
    chatMember.chat.type === 'supergroup'
  ) {
    if (
      chatMember.new_chat_member.status === 'administrator' ||
      chatMember.new_chat_member.status === 'member'
    ) {
      const inviterId = chatMember.from.id;
      const chatId = chatMember.chat.id;

      try {
        // 将邀请人设置为管理员
        await ctx.api.promoteChatMember(chatId, inviterId, {
          can_change_info: true,
          can_delete_messages: true,
          can_invite_users: true,
          can_restrict_members: true,
          can_pin_messages: true,
          can_manage_chat: true,
        });

        // 保存管理员信息到数据库
        await BotUser.findOneAndUpdate(
          { id: inviterId.toString() },
          {
            $set: {
              isAdmin: true,
              managedGroups: chatId,
            },
          },
          { new: true, upsert: true },
        );

        // 发送欢迎消息
        await ctx.api.sendMessage(
          chatId,
          '感谢邀请我加入群组！\n' +
            '邀请人已被自动设置为管理员。\n' +
            '请确保我具有管理员权限，否则上课/下课等功能将无法使用。\n' +
            '使用 /help 查看完整功能列表。',
        );
      } catch (error) {
        console.error('设置管理员失败:', error);
        await ctx.api.sendMessage(
          chatId,
          '警告：无法设置管理员权限。\n' +
            '请确保我具有完整的管理员权限，否则部分功能将无法使用。',
        );
      }
    }
  }
});

// 修改上课命令处理，添加权限检查
startCommand.hears(/^上课$/, async (ctx) => {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id;

  // 检查是否在群组中
  if (!chatId || ctx.chat?.type === 'private') {
    await ctx.reply('此命令只能在群组中使用');
    return;
  }

  // 检查用户是否是管理员
  const botUser = await BotUser.findOne({ id: userId, isAdmin: true });
  if (!botUser) {
    await ctx.reply('只有管理员才能使用此命令');
    return;
  }

  try {
    // 更新群组权限设置
    await ctx.api.setChatPermissions(chatId, {
      can_send_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });
    await ctx.reply('已开始营业，全员可发送消息');
  } catch (error) {
    console.error('设置群组权限失败:', error);
    await ctx.reply('设置群组权限失败，请确保我具有管理员权限');
  }
});

// 修改下课命令处理，添加权限检查
startCommand.hears(/^下课$/, async (ctx) => {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id;

  // 检查是否在群组中
  if (!chatId || ctx.chat?.type === 'private') {
    await ctx.reply('此命令只能在群组中使用');
    return;
  }

  // 检查用户是否是管理员
  const botUser = await BotUser.findOne({ id: userId, isAdmin: true });
  if (!botUser) {
    await ctx.reply('只有管理员才能使用此命令');
    return;
  }

  try {
    // 更新群组权限设置
    await ctx.api.setChatPermissions(chatId, {
      can_send_messages: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
    });
    await ctx.reply('已停止营业，全员禁止发送消息');
  } catch (error) {
    console.error('设置群组权限失败:', error);
    await ctx.reply('设置群组权限失败，请确保我具有管理员权限');
  }
});
