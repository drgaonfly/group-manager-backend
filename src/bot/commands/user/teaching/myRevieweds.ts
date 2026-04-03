import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import Evaluation from '../../../../models/evaluation';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:myRevieweds');
const myReviewedsCommand = new Composer<MyContext>();

const PAGE_SIZE = 5;

async function getReviewPage(teacherId: any, page: number = 1) {
  const total = await Evaluation.countDocuments({
    teacher: teacherId,
    status: 'approved',
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const evaluations = await Evaluation.find({
    teacher: teacherId,
    status: 'approved',
  })
    .populate('reviewer', 'userName firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  if (evaluations.length === 0) {
    return { text: '暂无已审核通过的评价', keyboard: null };
  }

  let text = `📋 **您的车评列表 (第 ${page}/${totalPages} 页)**\n\n`;

  evaluations.forEach((evaluation, index) => {
    const reviewer = evaluation.reviewer as any;
    const reviewerName = reviewer?.userName
      ? `@${reviewer.userName}`
      : `${reviewer?.firstName || ''} ${reviewer?.lastName || ''}`.trim() ||
        '匿名';

    text += `${(page - 1) * PAGE_SIZE + index + 1}. 👤 **${reviewerName}**\n`;
    text += `⭐ 评分：人照 ${evaluation.avatar_rating * 2} | 颜值 ${
      evaluation.appearance_rating * 2
    } | 身材 ${evaluation.body_rating * 2} | 服务 ${
      evaluation.service_rating * 2
    } | 态度 ${evaluation.attitude_rating * 2} | 环境 ${
      evaluation.circumstance_rating * 2
    }\n`;
    text += `💬 描述：${evaluation.process_desc}\n`;
    text += `📅 时间：${evaluation.createdAt.toLocaleString('zh-CN')}\n\n`;
  });

  const keyboard = new InlineKeyboard();
  if (page > 1) {
    keyboard.text('⬅️ 上一页', `my_reviews_page:${page - 1}`);
  }
  if (page < totalPages) {
    keyboard.text('下一页 ➡️', `my_reviews_page:${page + 1}`);
  }

  return { text, keyboard };
}

myReviewedsCommand.hears(/我的车评/, checkInBot, checkTeaching, async (ctx) => {
  debug('my reviews');

  const teacher = await Teacher.findOne({
    bot: ctx.currentBot!._id,
    botUser: ctx.currentBotUser!._id,
  });

  if (!teacher) {
    await ctx.reply('未找到老师信息');
    return;
  }

  const { text, keyboard } = await getReviewPage(teacher._id, 1);
  await ctx.reply(text, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
});

myReviewedsCommand.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('my_reviews_page:')) {
    return next();
  }

  const page = parseInt(data.split(':')[1]);
  const teacher = await Teacher.findOne({
    bot: ctx.currentBot!._id,
    botUser: ctx.currentBotUser!._id,
  });

  if (!teacher) {
    await ctx.answerCallbackQuery('未找到老师信息');
    return;
  }

  const { text, keyboard } = await getReviewPage(teacher._id, page);

  try {
    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    debug('Edit message failed:', e);
  }

  await ctx.answerCallbackQuery();
});

export default myReviewedsCommand;
