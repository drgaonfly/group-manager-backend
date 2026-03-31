import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../middlewares/checkGroup';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import { ITEMS_PER_PAGE } from '../../../../constants';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:menuingTeacher');
const menuingTeacherCommand = new Composer<MyContext>();

const getTeacherMenu = async (ctx: MyContext, page: number) => {
  // 1. 获取所有已审核通过的老师
  const teachers = await Teacher.find({
    bot: ctx.currentBot!._id,
    status: 'approved',
  })
    .populate('botUser')
    .sort({ updatedAt: -1 });

  if (teachers.length === 0) {
    return { text: '暂无在线老师', keyboard: null };
  }

  const totalPages = Math.ceil(teachers.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedTeachers = teachers.slice(start, end);

  // 2. 构建消息文本
  const messageText = [
    `以下为所有老师：`,
    `状态说明： 🟢可约  🔴休息中`,
    ``,
    `发送：**老师 名字** 可以跳出老师描述和榜单`,
    `发送：**老师 飞机号** 可以查看老师名下所有车评`,
  ].join('\n');

  // 3. 构建内联键盘 (一行三个)
  const keyboard = new InlineKeyboard();

  paginatedTeachers.forEach((teacher: any, index) => {
    const botUser = teacher.botUser;
    const name = botUser?.userName
      ? botUser.userName
      : `${botUser?.firstName || ''} ${botUser?.lastName || ''}`.trim() ||
        '老师';

    const statusIcon = teacher.isAvailable ? '🟢' : '🔴';
    const buttonText = `${statusIcon} ${name}`;

    keyboard.url(
      buttonText,
      teacher.contactLink || `https://t.me/${botUser?.userName || ''}`,
    );

    if ((index + 1) % 3 === 0) {
      keyboard.row();
    }
  });

  // 4. 添加分页按钮
  if (totalPages > 1) {
    keyboard.row();
    if (page > 1) {
      keyboard.text('⬅️ 上一页', `teachers_page:${page - 1}`);
    }
    if (page < totalPages) {
      keyboard.text('➡️ 下一页', `teachers_page:${page + 1}`);
    }
  }

  return { text: messageText, keyboard };
};

menuingTeacherCommand.hears('老师', checkGroup, checkTeaching, async (ctx) => {
  debug('menuing teacher triggered in group:', ctx.chat.id);

  // 删除旧的消息（如果 session 中存有 message_id）
  const lastMessageId = ctx.session.lastTeacherMenuId;
  if (lastMessageId) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, lastMessageId);
    } catch (e) {
      debug('Failed to delete old teacher menu message:', e);
    }
  }

  const { text, keyboard } = await getTeacherMenu(ctx, 1);
  const sentMessage = await ctx.reply(text, {
    reply_markup: keyboard || undefined,
    parse_mode: 'Markdown',
  });

  // 保存新的 message_id 到 session
  ctx.session.lastTeacherMenuId = sentMessage.message_id;
});

menuingTeacherCommand.callbackQuery(/^teachers_page:(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const { text, keyboard } = await getTeacherMenu(ctx, page);

  try {
    await ctx.editMessageText(text, {
      reply_markup: keyboard || undefined,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    debug('Error editing message:', error);
  }
  await ctx.answerCallbackQuery();
});

export default menuingTeacherCommand;
