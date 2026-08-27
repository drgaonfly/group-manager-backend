import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Setting from '../../../../models/setting';
import { createBotWithUser } from '../../../../utils/createBotWithUser';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import { checkBotPublic } from '../../../middlewares/checkBotPublic';
import createDebug from 'debug';

const debug = createDebug('bot:clone:handleToken');
const handleTokenComposer = new Composer<MyContext>();
/**
 * 监听私聊中直接发送的 Bot Token，自动触发克隆流程。
 * 仅在 public bot 下生效，private bot（克隆产物）不允许再次克隆。
 */
handleTokenComposer.hears(
  /^\d{8,}:[A-Za-z0-9_-]{35,}$/,
  checkBotPublic,
  async (ctx) => {
    const token = ctx.message.text?.trim() ?? '';
    const bot = ctx.currentBot;
    const botUser = ctx.currentBotUser;

    debug('收到用户直接发送的 token，开始克隆');

    await ctx.reply('✅ 已收到您的机器人Token，正在为您处理，请稍候...');

    let result;
    try {
      result = await createBotWithUser(token, bot, botUser);
    } catch (e: any) {
      debug('createBotWithUser 异常:', e);
      await ctx.reply(`❌ 克隆失败：${e.message || '未知错误'}`);
      return;
    }

    if (result.success) {
      const { loginUrl, userName, disabledAt } = result.account!;
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
          { parse_mode: 'HTML' },
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
          { parse_mode: 'HTML' },
        );
      }
    } else {
      await ctx.reply(`❌ 克隆失败：${result.message || '请稍后再试'}`);
    }
  },
);

export default handleTokenComposer;
