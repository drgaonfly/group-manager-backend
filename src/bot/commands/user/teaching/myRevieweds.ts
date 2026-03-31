import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:myRevieweds');
const myReviewedsCommand = new Composer<MyContext>();

myReviewedsCommand.hears(/我的车评/, checkInBot, checkTeaching, async (ctx) => {
  debug('my reviews');

  const teacher = await Teacher.findOne({
    bot: ctx.currentBot!._id,
    botUser: ctx.currentBotUser!._id,
  });

  const reviews = teacher?.reviews || [];
  if (reviews.length === 0) {
    await ctx.reply('暂无评论');
    return;
  }

  // reviews 现在是 string[]，直接按顺序展示最近的即可
  const latestReviews = [...reviews].reverse().slice(0, 20);

  const lines = latestReviews.map((content, idx) => {
    return `${idx + 1}. ${content}`;
  });

  await ctx.reply(`📋 我的收到评论：\n\n${lines.join('\n\n')}`);
});

export default myReviewedsCommand;
