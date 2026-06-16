import { Composer } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { cancelKeyboard } from '../../../menus/inline/cacel';
import Bot from '../../../../models/bot';
import BotUser from '../../../../models/botUser';
import { setWebhook } from '../../../../controllers/botController';
import createDebug from 'debug';

const debug = createDebug('bot:clone');
const cloneConversationComposer = new Composer<MyContext>();
const TIMEOUT = 5 * 60 * 1000;

// 这个是放在 clone_start 那的
async function cloneBotConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  debug('等待用户输入token或取消');
  // 等待用户输入token或取消
  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  // 处理取消
  if (
    (result.message && result.message.text === '取消') ||
    (result.callbackQuery &&
      (result.callbackQuery.data === 'close' ||
        result.callbackQuery.data === 'cancel'))
  ) {
    await ctx.reply('已取消克隆操作。');
    return;
  }

  // 检查token格式
  const token = result.message?.text?.trim();
  if (!token || !/^\d{8,}:[A-Za-z0-9_-]{35,}$/.test(token)) {
    await ctx.reply(
      [
        '❗ <b>请输入正确的机器人Token格式</b>，例如：',
        '<code>6422100000:AAFMTBWko3t7gA3mN5SRYp5FuYcxxxxxxxxx</code>',
        '',
        '如需取消，请点击下方按钮。',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: cancelKeyboard,
      },
    );
    // 递归等待用户重新输入
    return await cloneBotConversation(conversation, ctx);
  }

  // 处理收到的token
  debug('收到用户token:', token);
  await ctx.reply('✅ 已收到您的机器人Token，正在为您处理克隆，请稍候...');

  const addResult = await addBot(token, ctx);

  if (addResult && addResult.success) {
    await ctx.reply('✅ 克隆成功，请在机器人列表中查看。');
  } else {
    let failMsg = '❌ 克隆失败，请稍后再试。';
    if (addResult && addResult.message) {
      failMsg += `\n${addResult.message}`;
    }
    await ctx.reply(failMsg);
  }
  // 这里可以继续后续的克隆逻辑
}

// 新增一个方法 addBot，传入 token，返回 { success: boolean, message?: string }
async function addBot(
  token: string,
  ctx: MyContext,
): Promise<{ success: boolean; message?: string }> {
  try {
    let bot = ctx.currentBot;
    let botUser = ctx.currentBotUser;

    debug('[addBot] 入参 token:', token);
    debug('[addBot] ctx.currentBot:', bot ? bot.id || bot._id : null);
    debug(
      '[addBot] ctx.currentBotUser:',
      botUser ? botUser.id || botUser._id : null,
    );

    if (!botUser) {
      debug('[addBot] 当前 ctx.currentBotUser 不存在，尝试查找 BotUser');
      botUser = await BotUser.findOne({
        id: ctx.update.callback_query?.from?.id?.toString(),
      });
      debug(
        '[addBot] 查找 BotUser 结果:',
        botUser ? botUser.id || botUser._id : null,
      );
    }

    if (!bot) {
      debug('[addBot] 当前 ctx.currentBot 不存在，尝试查找 Bot');
      bot = await Bot.findOne({ id: ctx.me.id.toString() });
      debug('[addBot] 查找 Bot 结果:', bot ? bot.id || bot._id : null);
    }

    // 检查数据库中是否已存在该 token
    debug('[addBot] 检查 token 是否已存在...');
    const botExists = await Bot.findOne({ token });
    debug('[addBot] token 是否已存在:', !!botExists);
    if (botExists) {
      debug('[addBot] 该 Bot Token 已被使用:', token);
      return {
        success: false,
        message: '该 Bot Token 已被使用，请使用其他 Token',
      };
    }

    // 创建新 bots
    debug('[addBot] 创建新 Bot 实例...');
    const newBot = new Bot({ token });

    // 将当前用户作为新Bot的creator
    // 如果当前bot存在，设置新bot的clonedFrom为当前bot的_id，否则为null
    newBot.clonedFrom = bot?._id || null;
    newBot.creator = botUser?._id || null;

    debug('[addBot] newBot.clonedFrom:', newBot.clonedFrom);
    debug('[addBot] newBot.creator:', newBot.creator);

    await newBot.save();
    debug('[addBot] 新 Bot 已保存:', newBot._id);

    await setWebhook(newBot);

    // 注意这里原代码用 token 作为 _id 查找，应该用 newBot._id
    await Bot.findByIdAndUpdate(
      newBot._id,
      {
        $addToSet: {
          botUsers: botUser?._id,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
    debug('[addBot] 已将 botUser 添加到新 Bot 的 botUsers 列表:', botUser?._id);

    return { success: true };
  } catch (e: any) {
    debug('[addBot] 发生异常:', e);
    // 发生异常返回 false 和错误信息
    return { success: false, message: e?.message || '添加 Bot 失败' };
  }
}

// 注册对话
cloneConversationComposer.use(createConversation(cloneBotConversation));

// 入口按钮
cloneConversationComposer.callbackQuery('clone_start', async (ctx) => {
  const bot = ctx.currentBot;
  // 检查 bot 是否可克隆
  if (!bot?.canBeCloned) {
    await ctx.reply('❌ 该机器人不可克隆，请使用其他机器人。');
    return;
  }

  debug('clone_start clicked');
  await ctx.conversation.exitAll();

  debug('开始克隆机器人对话');
  // 发送克隆流程说明
  await ctx.reply(
    [
      '🤖 <b>克隆机器人流程</b>',
      '',
      '1. 打开 <b>@BotFather</b>',
      '2. 发送 <code>/newbot</code>',
      '3. 按指引设置机器人名字（可中文）',
      '4. 设置机器人 <b>username</b>（英文+数字，需以 <code>bot</code> 结尾）',
      '5. 创建完成后将注册好的 <b>token</b> 发送给我',
      '',
      'token格式示例：',
      '<code>6422100000:AAFMTBWko3t7gA3mN5SRYp5FuYcxxxxxxxxx</code>',
      '',
      '⏳ 此操作将在 5 分钟后过期。',
      '',
      '如需取消，请点击下方按钮。',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: cancelKeyboard,
    },
  );

  await ctx.conversation.enter('cloneBotConversation');
  await ctx.answerCallbackQuery();
});

export default cloneConversationComposer;
