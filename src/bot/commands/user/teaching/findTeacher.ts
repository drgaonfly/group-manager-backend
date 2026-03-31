import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import BotUser from '../../../../models/botUser';

import createDebug from 'debug';
const debug = createDebug('bot:teaching:findTeacher');
const findTeacherCommand = new Composer<MyContext>();

findTeacherCommand.hears(
  /找老师\s*(.*)/,
  checkInBot,
  checkTeaching,
  async (ctx) => {
    const query = ctx.match[1]?.trim();
    debug('find teacher query:', query);

    if (!query) {
      await ctx.reply(
        '请输入要搜索的老师用户名或姓名，例如：\n`找老师 @username` 或 `找老师 姓名`',
      );
      return;
    }

    // 处理用户名搜索，去掉开头的 @ 符号
    const searchName = query.startsWith('@') ? query.slice(1) : query;

    // 先在 BotUser 中模糊搜索
    const botUsers = await BotUser.find({
      $or: [
        { userName: { $regex: searchName, $options: 'i' } },
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

    const message = [
      `🔍 搜索结果：`,
      '',
      ...teachers.map((t: any, idx) => {
        const botUser = t.botUser;
        const name = botUser?.userName
          ? `@${botUser.userName}`
          : `${botUser?.firstName || ''} ${botUser?.lastName || ''}`.trim() ||
            '未知用户';

        const status = t.isAvailable ? '✅ 可接单' : '❌ 忙碌中';
        return [
          `*${idx + 1}. ${name}*`,
          `状态：${status}`,
          `联系方式：${t.contactLink || '未设置'}`,
          `简介：\n${t.brief || '无'}`,
        ].join('\n');
      }),
    ].join('\n\n');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  },
);

export default findTeacherCommand;
