import { Composer } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { cancelKeyboard } from '../../../menus/inline/cacel';
import { IBotUser } from '../../../../models/botUser';
import { createBotWithUser } from '../../../../utils/createBotWithUser';
import createDebug from 'debug';

const debug = createDebug('bot:clone');
const cloneConversationComposer = new Composer<MyContext>();
const TIMEOUT = 5 * 60 * 1000;

async function cloneBotConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { botUser }: { botUser: IBotUser },
) {
  debug('等待用户输入token或取消');

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
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

  // 校验 token 格式
  const token = result.message?.text?.trim();
  if (!token || !/^\d{8,}:[A-Za-z0-9_-]{35,}$/.test(token)) {
    await ctx.reply(
      [
        '❗ <b>请输入正确的机器人Token格式</b>，例如：',
        '<code>6422100000:AAFMTBWko3t7gA3mN5SRYp5FuYcxxxxxxxxx</code>',
        '',
        '如需取消，请点击下方按钮。',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: cancelKeyboard },
    );
    return await cloneBotConversation(conversation, ctx, { botUser });
  }

  debug('收到用户token:', token);
  await ctx.reply('✅ 已收到您的机器人Token，正在为您处理，请稍候...');

  const result2 = await createBotWithUser(token, ctx.currentBot, botUser);

  if (result2.success) {
    const { loginUrl } = result2.account!;
    if (loginUrl) {
      await ctx.reply(
        [
          '✅ <b>克隆成功！</b>',
          '',
          '您的专属机器人已创建完成，点击下方按钮即可直接登录管理后台：',
          '',
          `🌐 <a href="${loginUrl}">🖥️ 登录管理后台</a>`,
          '',
          '� 机器人正在初始化，稍后即可正常使用。',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    } else {
      await ctx.reply(
        [
          '✅ <b>克隆成功！</b>',
          '',
          '您的专属机器人已创建完成，但登录链接生成失败，请联系管理员。',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    }
  } else {
    await ctx.reply(`❌ 克隆失败：${result2.message || '请稍后再试'}`);
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
    botUser: ctx.currentBotUser,
  });
  await ctx.answerCallbackQuery();
});

export default cloneConversationComposer;
