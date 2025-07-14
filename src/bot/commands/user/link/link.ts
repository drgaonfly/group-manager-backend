import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkPermission } from '../../../middlewares/checkPermission';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const linkCommand = new Composer<MyContext>();

const debug = createDebug('bot:link');

export async function handleLink(ctx: MyContext) {
  // 查询所有 BotUserConfig，并关联 botUser 字段
  const botUserConfigs = await BotUserConfig.find().populate('botUser');

  if (botUserConfigs.length === 0) {
    ctx.reply('暂无用户');
    return;
  }

  debug('botUserConfigs:', botUserConfigs.length);

  // 按 invited_counts 降序排序
  const sortedConfigs = botUserConfigs
    .filter((c: any) => c.invited_counts && c.botUser)
    .sort(
      (a: any, b: any) => (b.invited_counts || 0) - (a.invited_counts || 0),
    );

  // 生成排行榜文本
  let message = [
    `<b>邀请人数排行</b>`,
    `\n`,
    `你已经邀请了${ctx.currentBotUserConfig.invited_counts}人`,
    `\n`,
  ].join('\n');

  if (sortedConfigs.length === 0) {
    message += '暂无数据';
  } else {
    sortedConfigs.forEach((config: any, idx: number) => {
      message += `${idx + 1}. ${config.botUser.displayName} - <b>${
        config.invited_counts || 0
      }</b> 人\n`;
    });
  }

  await ctx.reply(message, {
    parse_mode: 'HTML',
  });
}

// 邀请链接命令处理
linkCommand.command('links', checkPermission, async (ctx) => {
  debug('link');

  await handleLink(ctx);
});

export default linkCommand;
