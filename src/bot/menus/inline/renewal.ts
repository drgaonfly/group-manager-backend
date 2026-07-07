// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

const renewal = new InlineKeyboard();

const plans = [
  { months: 1, price: 15, label: '一个月', type: 'subscribe:monthly' },
  { months: 1, price: 400, label: '永久', type: 'subscribe:lifetime' },
];

plans.forEach((option) => {
  renewal.text(`${option.label} (${option.price}U)`, option.type).row();
});

export default renewal;
