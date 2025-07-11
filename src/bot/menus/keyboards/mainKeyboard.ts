import { Keyboard } from 'grammy';
import type { MyContext } from '../../types'; // 替换为你自己的 ctx 类型

async function createMainKeyboard(ctx: MyContext) {
  const keyboard = new Keyboard();

  // Add default buttons (与原始键一致)
  keyboard.text('推广链接');

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
