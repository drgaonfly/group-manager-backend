import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import Teacher from '../../../../models/teacher';
import BotUser from '../../../../models/botUser';

import createDebug from 'debug';
const debug = createDebug('bot:teaching:findTeacher');
const findTeacherCommand = new Composer<MyContext>();

findTeacherCommand.hears(/找老师\s*(.*)/, checkInBot, async (ctx) => {
  const query = ctx.match[1]?.trim();
  debug('find teacher query:', query);

  if (!query) {
    await ctx.reply(
      '请输入要搜索的老师用户名或姓名，例如：\n`找老师 @username` 或 `找老师 姓名`',
    );
    return;
  }

  // 先在 BotUser 中模糊搜索
  const botUsers = await BotUser.find({
    $or: [
      { userName: { $regex: query, $options: 'i' } },
      { firstName: { $regex: query, $options: 'i' } },
      { lastName: { $regex: query, $options: 'i' } },
    ],
  }).select('_id');

  if (botUsers.length === 0) {
    await ctx.reply('未找到匹配的用户');
    return;
  }

  const botUserIds = botUsers.map((u) => u._id);

  // 在 Teacher 中查找，只找已审核通过的
  const teachers = await Teacher.find({
    bot: ctx.currentBot!._id,
    botUser: { $in: botUserIds },
    status: 'approved',
  })
    .populate('botUser')
    .sort({ updatedAt: -1 })
    .limit(10);

  if (teachers.length === 0) {
    await ctx.reply('未找到相关的认证老师');
    return;
  }

  const lines = teachers.map((t: any, idx) => {
    const botUser = t.botUser;
    const name = botUser?.userName
      ? `@${botUser.userName}`
      : `${botUser?.firstName || ''} ${botUser?.lastName || ''}`.trim() ||
        '未知用户';

    const status = t.isAvailable ? '✅ 可接单' : '❌ 忙碌中';
    return `*${idx + 1}. ${name}*\n状态：${status}\n联系方式：${
      t.contactLink || '未设置'
    }`;
  });

  await ctx.reply(`🔍 搜索结果：\n\n${lines.join('\n\n')}`, {
    parse_mode: 'Markdown',
  });
});

export default findTeacherCommand;
