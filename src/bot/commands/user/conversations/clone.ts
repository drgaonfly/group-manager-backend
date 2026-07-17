import { Composer } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { cancelKeyboard } from '../../../menus/inline/cacel';
import { IBot } from '../../../../models/bot';
import { IBotUser } from '../../../../models/botUser';
import Setting from '../../../../models/setting';
import { createBotWithUser } from '../../../../utils/createBotWithUser';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import createDebug from 'debug';

const debug = createDebug('bot:clone');
const cloneConversationComposer = new Composer<MyContext>();
const TIMEOUT = 5 * 60 * 1000;

async function cloneBotConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { bot, botUser }: { bot: IBot; botUser: IBotUser },
) {
  debug('进入克隆机器人流程');

  while (true) {
    let result;

    try {
      debug('等待用户输入token或取消');

      result = await conversation.waitFor(
        ['message:text', 'callback_query:data'],
        { maxMilliseconds: TIMEOUT },
      );
    } catch (e: any) {
      debug('等待输入超时:', e);

      await ctx.reply('⏰ 克隆操作已超时，请重新开始。');
      return;
    }

    // ==========================
    // 处理取消
    // ==========================
    if (result.callbackQuery?.data === 'close') {
      await ctx.reply('已取消克隆操作。');
      return;
    }

    // ==========================
    // 获取 token
    // ==========================
    const token = result.message?.text?.trim();

    // ==========================
    // token格式验证
    // ==========================
    if (!token || !/^\d{8,}:[A-Za-z0-9_-]{35,}$/.test(token)) {
      await ctx.reply(
        [
          '❗ <b>请输入正确的机器人Token格式</b>',
          '',
          '例如：',
          '<code>6422100000:AAFMTBWko3t7gA3mN5SRYp5FuYcxxxxxxxxx</code>',
          '',
          '如需取消，请点击下方按钮。',
        ].join('\n'),
        {
          parse_mode: 'HTML',
          reply_markup: cancelKeyboard,
        },
      );

      // 继续等待下一次输入
      continue;
    }

    debug('收到用户token:', token);

    await ctx.reply('✅ 已收到您的机器人Token，正在为您处理，请稍候...');

    // ==========================
    // 创建机器人
    // ==========================
    let result2;

    try {
      result2 = await createBotWithUser(token, bot, botUser);
    } catch (e: any) {
      debug('createBotWithUser异常:', e);

      await ctx.reply(`❌ 克隆失败：${e.message || '未知错误'}`);

      return;
    }

    // ==========================
    // 创建成功
    // ==========================
    if (result2.success) {
      const { loginUrl, userName, disabledAt } = result2.account!;

      // 获取系统设置中的免费天数
      const setting = await Setting.findOne();

      if (loginUrl) {
        await ctx.reply(
          [
            '✅ <b>克隆成功！</b>',
            '',
            `您的专属机器人已创建完成，已赠送 ${
              setting?.defaultFreeDays ?? 3
            } 天试用期。`,
            '',
            '请点击下方用户名打开您的机器人，并添加至群组设置为管理员。',
            '',
            `您的机器人：@${userName}`,
            '',
            `有效期：${formatBeijingDate(disabledAt)}`,
            '',
            `🌐 <a href="${loginUrl}">🖥️ 登录管理后台</a>`,
            '',
            '🤖 机器人正在初始化，稍后即可正常使用。',
          ].join('\n'),
          {
            parse_mode: 'HTML',
          },
        );
      } else {
        await ctx.reply(
          [
            '✅ <b>克隆成功！</b>',
            '',
            '您的专属机器人已创建完成。',
            '',
            '但是登录链接生成失败，请联系管理员。',
          ].join('\n'),
          {
            parse_mode: 'HTML',
          },
        );
      }
    } else {
      await ctx.reply(`❌ 克隆失败：${result2.message || '请稍后再试'}`);
    }

    // 完成退出conversation
    return;
  }
}

// 注册对话
cloneConversationComposer.use(createConversation(cloneBotConversation));

// 入口按钮
cloneConversationComposer.callbackQuery('clone_start', async (ctx) => {
  debug('clone_start clicked');

  // private 机器人（克隆产物）不允许再次克隆
  if (ctx.currentBot?.type === 'private') {
    await ctx.answerCallbackQuery({
      text: '此机器人不支持克隆操作',
      show_alert: true,
    });
    return;
  }

  await ctx.conversation.exitAll();

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
    { parse_mode: 'HTML', reply_markup: cancelKeyboard },
  );

  await ctx.conversation.enter('cloneBotConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
  await ctx.answerCallbackQuery();
});

export default cloneConversationComposer;
