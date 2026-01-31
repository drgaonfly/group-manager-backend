import { InlineKeyboard } from 'grammy';

interface MenuItem {
  name?: string; // sendMessage 和 sendGroupMessage 使用
  url: string;
}

export const buildInlineKeyboard = (
  menus: MenuItem[],
  menusPerRow: number = 1,
): InlineKeyboard | undefined => {
  // 如果没有菜单或菜单数组为空，返回 undefined
  if (!Array.isArray(menus) || menus.length === 0) {
    return undefined;
  }

  const keyboard = new InlineKeyboard();

  // 按行分组构建菜单
  for (let i = 0; i < menus.length; i += menusPerRow) {
    const rowMenus = menus.slice(i, i + menusPerRow);

    // 过滤并构建有效按钮（支持 name 和 name 字段）
    const buttons = rowMenus
      .filter((menu: MenuItem) => {
        const menuText = menu.name || menu.name;
        return menuText && menu.url;
      })
      .map((menu: MenuItem) => ({
        text: menu.name!,
        url: menu.url,
      }));

    // 添加这一行按钮
    if (buttons.length > 0) {
      keyboard.add(...buttons).row();
    }
  }

  return keyboard;
};
