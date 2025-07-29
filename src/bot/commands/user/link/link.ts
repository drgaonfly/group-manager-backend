import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import BotUserConfig from '../../../../models/botUserConfig';
import { checkGroup } from '../../../middlewares/checkGroup';
import createDebug from 'debug';

const linkCommand = new Composer<MyContext>();

const debug = createDebug('bot:link');

export async function handleLink(ctx: MyContext) {
  // 查询所有 BotUserConfig，并关联 botUser 字段
  const botUserConfigs = await BotUserConfig.find().populate('botUser');

  if (botUserConfigs.length === 0) {
    ctx.reply('No users found.');
    return;
  }

  debug('botUserConfigs:', botUserConfigs.length);

  console.log('invited_group:', botUserConfigs[0].invited_group);

  // 按 invited_counts 降序排序
  const sortedConfigs = botUserConfigs
    .filter(
      (c: any) =>
        c.invited_counts &&
        c.botUser &&
        c.invited_group === ctx.currentGroup._id.toString(),
    )
    .sort(
      (a: any, b: any) => (b.invited_counts || 0) - (a.invited_counts || 0),
    );

  const invitation_counts_in_group = await BotUserConfig.find({
    parent: ctx.currentBotUserConfig._id.toString(),
    invited_group: ctx.currentGroup._id.toString(),
  }).countDocuments();

  // 生成排行榜文本
  let message = [
    `<b>Invitation Leaderboard</b>`,
    `\n`,
    `You have invited ${invitation_counts_in_group} people in this Group ${ctx.currentGroup.title}`,
    `\n`,
  ].join('\n');

  if (sortedConfigs.length === 0) {
    message += 'No data';
  } else {
    sortedConfigs.forEach((config: any, idx: number) => {
      message += `${idx + 1}. ${config.botUser.displayName} - <b>${
        config.invited_counts || 0
      }</b> people\n`;
    });
  }

  // if (ctx.message.chat.type === 'private') {
  //   await ctx.reply(message, {
  //     parse_mode: 'HTML',
  //   });
  // } else if (ctx.message.chat.type === 'group') {
  // await ctx.reply([message, `\n`, ctx.currentGroup.message].join('\n'), {
  //   parse_mode: 'HTML',
  // });
  // }

  await ctx.reply([message, `\n`, ctx.currentGroup.message].join('\n'), {
    parse_mode: 'HTML',
  });
}

// 邀请链接命令处理
linkCommand.command('links', checkGroup, async (ctx) => {
  debug('link');

  await handleLink(ctx);
});

export default linkCommand;
