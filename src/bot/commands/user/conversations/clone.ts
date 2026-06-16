import { Composer } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { cancelKeyboard } from '../../../menus/inline/cacel';
import BotUser from '../../../../models/botUser';
import { createBotWithUser } from '../../../../utils/createBotWithUser';
import createDebug from 'debug';

const debug = createDebug('bot:clone');
const cloneConversationComposer = new Composer<MyContext>();
const TIMEOUT = 5 * 60 * 1000;

async function cloneBotConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
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
    return await cloneBotConversation(conversation, ctx);
  }

  debug('收到用户token:', token);
  await ctx.reply('✅ 已收到您的机器人Token，正在为您处理，请稍候...');

  // 获取操作者 BotUser（conversation 内 ctx 可能丢失，补查一次）
  const botUser =
    ctx.currentBotUser ||
    (await BotUser.findOne({
      id: ctx.from?.id?.toString(),
    }));

  const result2 = await createBotWithUser(token, ctx.currentBot, botUser);

  if (result2.success) {
    const { email, password } = result2.account!;
    const adminUrl = process.env.FRONTEND_URL || '请联系管理员获取后台地址';
    await ctx.reply(
      [
        '✅ <b>克隆成功！</b>',
        '',
        '您的后台管理账号已自动创建，请妥善保存：',
        '',
        `📧 <b>账号（邮箱）：</b><code>${email}</code>`,
        `🔑 <b>密码：</b><code>${password}</code>`,
        `🌐 <b>后台地址：</b>${adminUrl}`,
        '',
        '💡 机器人正在初始化，稍后即可正常使用。',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  } else {
    await ctx.reply(`❌ 克隆失败：${result2.message || '请稍后再试'}`);
  }
}

// 注册对话
cloneConversationComposer.use(createConversation(cloneBotConversation));

// 入口按钮
cloneConversationComposer.callbackQuery('clone_start', async (ctx) => {
  debug('clone_start clicked');
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

  await ctx.conversation.enter('cloneBotConversation');
  await ctx.answerCallbackQuery();
});

export default cloneConversationComposer;
