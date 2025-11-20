import type { MyContext } from '../../types';

// 不再创建键盘菜单，返回 undefined 表示不显示键盘
async function createMainKeyboard(ctx: MyContext) {
  // 返回 undefined 表示不显示任何键盘菜单
  return undefined;
}

export default createMainKeyboard;
