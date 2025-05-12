import { Composer } from 'grammy';
import { MyContext } from '../../types';
import createDebug from 'debug';
import BotUser, { IBotUser } from '../../../models/botUser';
import { IBot } from '../../../models/bot';

const addOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:addOperator');

// 匹配 "设置操作人@机器人名 @用户" 格式的命令
addOperatorCommand.hears(/^设置操作人(@\S+\s*)+$/, async (ctx) => {
  debug('addOperator');

  const rawOperators = ctx.message.entities.filter(
    (entity) => entity.type === 'text_mention',
  );
  console.log('ctx.message.entities', ctx.message.entities);

  //   const creator = ctx.currentGroup.creator as IBotUser;

  //   if (ctx.currentBotUser._id !== creator) {
  //     await ctx.reply(
  //       '您不是当前权限人哦！此群机器人由<DeepPay888 Deep Pay>首次设置.',
  //     );
  //     return;
  //   }

  // 使用Promise.all并行处理所有操作人
  await Promise.all(
    rawOperators.map(async (raw: any) => {
      let existBotUser: IBotUser = await BotUser.findOneAndUpdate(
        {
          id: raw.user.id,
        },
        {
          $set: {
            userName: raw.user.first_name + raw.user.last_name,
            firstName: raw.user.first_name,
            lastName: raw.user.last_name,
          },
        },
        { new: true, upsert: true },
      );

      // 检查当前机器人ID是否已存在于用户的bots列表中
      if (!(existBotUser.bots as IBot[]).includes(ctx.currentBot._id)) {
        (existBotUser.bots as IBot[]).push(ctx.currentBot._id);
        await existBotUser.save();
      }
    }),
  );

  const filteredBotUsers = await BotUser.find({
    bots: { $in: [ctx.currentBot._id] },
  }).select('_id');

  console.log('filteredBotUsers', filteredBotUsers);

  // 过滤掉已经存在的操作人
  const newOperators = filteredBotUsers.filter(
    (botUser) => !ctx.currentGroup.operators.includes(botUser._id),
  );

  // 将新的操作人添加到列表中
  if (newOperators.length > 0) {
    ctx.currentGroup.operators.push(...newOperators);
    await ctx.currentGroup.save();
  }

  //   // 格式化回复消息
  const operatorsList = filteredBotUsers.map((op) => `@${op}`).join(' ');
  await ctx.reply(`已将 ${operatorsList} 设置为操作人`);
});

export default addOperatorCommand;
