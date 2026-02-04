import { InlineKeyboard } from 'grammy';
import { INotifyButton } from '../../models/lottery';

/**
 * 根据按钮配置生成 Telegram InlineKeyboard
 * @param buttons 按钮配置数组
 * @returns InlineKeyboard 对象
 */
export function buildInlineKeyboard(
  buttons: INotifyButton[],
): InlineKeyboard | undefined {
  if (!buttons || buttons.length === 0) {
    return undefined;
  }

  const keyboard = new InlineKeyboard();

  // 按 row 字段分组
  const rowMap = new Map<number, Array<{ text: string; url: string }>>();
  for (const button of buttons) {
    if (button.name && button.url) {
      const row = button.row || 1;
      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }
      rowMap.get(row)!.push({ text: button.name, url: button.url });
    }
  }

  // 按 row 排序后添加按钮
  const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
  for (const row of sortedRows) {
    const buttons = rowMap.get(row)!;
    if (buttons.length > 0) {
      keyboard.add(...buttons).row();
    }
  }

  return keyboard;
}
