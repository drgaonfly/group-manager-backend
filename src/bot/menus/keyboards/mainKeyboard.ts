import { Keyboard } from 'grammy';
import type { MyContext } from '../../types'; // 替换为你自己的 ctx 类型

async function createMainKeyboard(ctx: MyContext) {
  const keyboard = new Keyboard();

  // Add custom keyboard buttons from bot configuration
  if (ctx.currentBot?.keyboards && ctx.currentBot.keyboards.length > 0) {
    keyboard.row();

    // 按 row 字段排序并分组
    const sortedKeyboards = [...ctx.currentBot.keyboards].sort(
      (a, b) => (a.row || 1) - (b.row || 1),
    );

    // 按行号分组
    const groupedByRow: { [key: number]: typeof sortedKeyboards } = {};
    sortedKeyboards.forEach((item) => {
      const rowNum = item.row || 1;
      if (!groupedByRow[rowNum]) {
        groupedByRow[rowNum] = [];
      }
      groupedByRow[rowNum].push(item);
    });

    // 渲染每一行的按钮
    Object.keys(groupedByRow)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((rowKey) => {
        const rowButtons = groupedByRow[Number(rowKey)];
        rowButtons.forEach((item) => {
          // 使用 label 作为按钮显示文本，如果没有 label 则使用 command（向后兼容）
          keyboard.text(item.label || item.command);
        });
        keyboard.row(); // 每行结束后换行
      });
  }

  return keyboard.resized();
}

export default createMainKeyboard;
