import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';

const useCommand = new Composer<MyContext>();
const debug = createDebug('bot:starting');

// 监听"开始使用"文本消息
useCommand.hears(/开始使用/, async (ctx) => {
  debug('开始使用命令被触发');

  const message = `欢迎使用记账统计\n\n机器人可免费试用12小时，从机器人进群首次激活后开始计时`;

  // 添加联系客服按钮，使用url参数直接跳转到客服链接
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📖 详细说明',
            callback_data: 'show_details',
          },
          {
            text: '📝 开始记账',
            url: `https://t.me/${ctx.me.username}?startgroup=true`,
          },
        ],
      ],
    },
  });
});

export default useCommand;
