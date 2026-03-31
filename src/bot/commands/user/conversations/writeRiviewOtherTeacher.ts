import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import BotUser from '../../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:writeReview');
const writeReviewComposer = new Composer<MyContext>();

const TIMEOUT = 5 * 60 * 1000;
const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeRiviewOtherTeacherConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
  }: {
    bot: any;
    botUser: any;
  },
) {
  await ctx.reply(
    '请发送：老师名字 评论内容（例如：张三 服务很好 或 @abc 服务很好）',
    {
      reply_markup: cancelKeyboard,
    },
  );

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (result.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const text = result.message?.text?.trim() || '';
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply('格式不正确，请按：老师名字 评论内容（中间用空格隔开）');
    return writeRiviewOtherTeacherConversation(conversation, ctx, {
      bot,
      botUser,
    });
  }

  const teacherNameRaw = parts[0].trim();
  const content = parts.slice(1).join(' ').trim();

  if (!content) {
    await ctx.reply('评论内容不能为空');
    return writeRiviewOtherTeacherConversation(conversation, ctx, {
      bot,
      botUser,
    });
  }

  const teacherKey = teacherNameRaw.replace(/^@/, '');
  const safe = escapeRegExp(teacherKey);
  const regex = new RegExp(safe, 'i');

  const candidatesBotUsers = await BotUser.find({
    $or: [{ userName: regex }, { firstName: regex }, { lastName: regex }],
  })
    .select('_id userName firstName lastName')
    .limit(20);

  if (candidatesBotUsers.length === 0) {
    await ctx.reply('未找到匹配的用户，请换一个名字或 username 再试');
    return;
  }

  const botUserIds = candidatesBotUsers.map((u) => u._id);

  const teachers = await Teacher.find({
    bot: ctx.currentBot!._id,
    botUser: { $in: botUserIds },
    status: 'approved',
  })
    .populate('botUser')
    .limit(10);

  if (teachers.length === 0) {
    await ctx.reply('未找到匹配的认证老师');
    return;
  }

  const selectable = teachers.filter(
    (t: any) => t.botUser?._id?.toString?.() !== botUser._id.toString(),
  );

  if (selectable.length === 0) {
    await ctx.reply('不能给自己写评论');
    return;
  }

  const reviewerName = botUser?.userName
    ? `@${botUser.userName}`
    : `${botUser?.firstName || ''} ${botUser?.lastName || ''}`.trim() || '用户';

  const createReview = async (teacher: any) => {
    await Teacher.updateOne(
      { _id: teacher._id },
      {
        $push: {
          reviews: `来自 ${reviewerName} 的评论：${content}`,
        },
      },
    );

    debug('review saved', { teacher: teacher._id });
    await ctx.reply('✅ 评论已提交');
  };

  if (selectable.length === 1) {
    await createReview(selectable[0]);
    return;
  }

  const keyboard = new InlineKeyboard();
  const listLines = selectable.map((t: any, i: number) => {
    const u = t.botUser;
    const name = u?.userName
      ? `@${u.userName}`
      : `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || '未知用户';
    keyboard.text(`${i + 1}`, `teach_review_select:${t._id.toString()}`);
    keyboard.row();
    return `${i + 1}. ${name} \n${t.contactLink}`;
  });

  keyboard.text('❌ 取消', 'close');

  await ctx.reply(['匹配到多个老师，请选择：', '', ...listLines].join('\n'), {
    reply_markup: keyboard,
  });

  const pick = await conversation.waitFor(['callback_query:data'], {
    maxMilliseconds: TIMEOUT,
  });

  const data = pick.callbackQuery?.data;

  const m = data.match(/^teach_review_select:(.+)$/);
  if (!m) {
    await ctx.reply('选择无效，请重试');
    return;
  }

  const selectedId = m[1];
  const selected = selectable.find((t: any) => t._id.toString() === selectedId);
  if (!selected) {
    await ctx.reply('选择无效，请重试');
    return;
  }

  await createReview(selected);
}

writeReviewComposer.use(
  createConversation(writeRiviewOtherTeacherConversation),
);

writeReviewComposer.hears(/写车评/, checkInBot, checkTeaching, async (ctx) => {
  await ctx.conversation.exitAll();

  await ctx.conversation.enter('writeRiviewOtherTeacherConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
});

export default writeReviewComposer;
