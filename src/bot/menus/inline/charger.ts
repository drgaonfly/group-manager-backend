// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

import { chargeOptions } from '../../../models/payment';

const charger = new InlineKeyboard();

chargeOptions.forEach((option, idx) => {
  charger.text(option.label, option.callback);
  // 每3个一行，最后一行（自定义/取消）单独一行
  if ((idx + 1) % 3 === 0 && idx < chargeOptions.length - 2) {
    charger.row();
  }
});
charger.row(); // 保证最后一行分隔

export default charger;
