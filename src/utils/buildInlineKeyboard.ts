import { InlineKeyboard } from 'grammy';

interface MenuItem {
  name?: string;
  url: string;
  row?: number;
  style?: 'primary' | 'success' | 'danger';
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

  // 检查是否所有菜单都有 row 字段
  const hasRowField = menus.every((menu) => menu.row !== undefined);

  if (hasRowField) {
    // 使用 row 字段分组
    // 按 row 分组
    const groupedByRow = menus.reduce(
      (acc, menu) => {
        const row = menu.row || 0;
        if (!acc[row]) {
          acc[row] = [];
        }
        acc[row].push(menu);
        return acc;
      },
      {} as Record<number, MenuItem[]>,
    );

    // 按行号排序并构建键盘
    const sortedRows = Object.keys(groupedByRow)
      .map(Number)
      .sort((a, b) => a - b);

    sortedRows.forEach((rowNum) => {
      const rowMenus = groupedByRow[rowNum];
      const buttons = rowMenus
        .filter((menu) => menu.name && menu.url)
        .map((menu) => {
          const buttonConfig: any = {
            text: menu.name!,
            url: menu.url,
          };

          // 添加样式支持 (Bot API 9.4+)
          if (menu.style) {
            buttonConfig.style = menu.style;
          }

          return buttonConfig;
        });

      if (buttons.length > 0) {
        keyboard.add(...buttons).row();
      }
    });
  } else {
    // 使用 menusPerRow 分组（兼容旧逻辑）
    for (let i = 0; i < menus.length; i += menusPerRow) {
      const rowMenus = menus.slice(i, i + menusPerRow);

      const buttons = rowMenus
        .filter((menu: MenuItem) => menu.name && menu.url)
        .map((menu: MenuItem) => {
          const buttonConfig: any = {
            text: menu.name!,
            url: menu.url,
          };

          // 添加样式支持 (Bot API 9.4+)
          if (menu.style) {
            buttonConfig.style = menu.style;
          }

          return buttonConfig;
        });

      if (buttons.length > 0) {
        keyboard.add(...buttons).row();
      }
    }
  }

  return keyboard;
};
