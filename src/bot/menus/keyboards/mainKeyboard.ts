import { Keyboard } from 'grammy';
import type { MyContext } from '../../types'; // 替换为你自己的 ctx 类型

async function createMainKeyboard(ctx: MyContext) {
  const keyboard = new Keyboard();

  // Add default buttons (与原始键一致)
  keyboard
    .text('▶️ 开始记账')
    .text('🆓 免费克隆')
    .row()
    .text('💱 TRX 兑换')
    .text('🏦 地址监听')
    .row()
    .text('💬 联系客服')
    .text('👤 个人信息');

  // Add custom keyboard buttons from bot configuration
  if (ctx.currentBot?.keyboards && ctx.currentBot.keyboards.length > 0) {
    keyboard.row();
    ctx.currentBot.keyboards.forEach((item, index) => {
      keyboard.text(item.command);
      if (
        (index + 1) % 2 === 0 ||
        index === ctx.currentBot.keyboards.length - 1
      ) {
        keyboard.row();
      }
    });
  }

  return keyboard.resized();
}

export default createMainKeyboard;
