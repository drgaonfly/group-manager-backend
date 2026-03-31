import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../middlewares/checkGroup';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:setAvailable');
const setAvailableComposer = new Composer<MyContext>();

setAvailableComposer.hears(
  /^(上课|下课)$/,
  checkGroup,
  checkTeaching,
  async (ctx) => {
    const text = ctx.match[1];
    const isAvailable = text === '上课';

    debug('setAvailable:', text, isAvailable);

    const teacher = await Teacher.findOne({
      bot: ctx.currentBot!._id,
      botUser: ctx.currentBotUser!._id,
    });

    if (!teacher) {
      debug('用户不是老师');
      return;
    }

    if (teacher.status !== 'approved') {
      await ctx.reply('您的老师认证尚未通过，无法切换状态。');
      return;
    }

    teacher.isAvailable = isAvailable;
    await teacher.save();

    await ctx.reply(`✅ 已切换为：${text}状态`);
  },
);

export default setAvailableComposer;
