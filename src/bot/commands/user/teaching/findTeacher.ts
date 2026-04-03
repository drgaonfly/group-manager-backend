import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import { searchTeachers } from '../../../../services/teacherService';

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

    const { message } = await searchTeachers(query, ctx.currentBot!._id);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  },
);

export default findTeacherCommand;
