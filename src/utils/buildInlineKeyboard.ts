import { InlineKeyboard } from 'grammy';

interface MenuItem {
  _id?: string;
  name?: string;
  url?: string;
  callback?: string;
  callback_data?: string;
  copy_text?: string;
  type?: 'url' | 'callback' | 'copy_text';
  row?: number;
  style?: 'primary' | 'success' | 'danger';
}

export const buildInlineKeyboard = (
  menus: MenuItem[],
  menusPerRow: number = 1,
): InlineKeyboard | undefined => {
  if (!Array.isArray(menus) || menus.length === 0) {
    return undefined;
  }

  const buildButton = (menu: MenuItem): any | null => {
    const type = menu.type || (menu.url ? 'url' : 'url');
    const text = menu.name;
    if (!text) return null;

    switch (type) {
      case 'callback': {
        const cbData =
          menu.callback_data || (menu._id ? String(menu._id) : null);
        if (!cbData) return null;
        return { text, callback_data: cbData };
      }
      case 'copy_text': {
        if (!menu.copy_text) return null;
        return { text, copy_text: { text: menu.copy_text } } as any;
      }
      case 'url':
      default: {
        if (!menu.url) return null;
        const btn: any = { text, url: menu.url };
        if (menu.style) btn.style = menu.style;
        return btn;
      }
    }
  };

  // 按 row 分组
  const hasRowField = menus.every((menu) => menu.row !== undefined);

  const buildRows = (): any[][] => {
    if (hasRowField) {
      const groupedByRow = menus.reduce(
        (acc, menu) => {
          const row = menu.row || 0;
          if (!acc[row]) acc[row] = [];
          acc[row].push(menu);
          return acc;
        },
        {} as Record<number, MenuItem[]>,
      );

      return Object.keys(groupedByRow)
        .map(Number)
        .sort((a, b) => a - b)
        .map((rowNum) => groupedByRow[rowNum].map(buildButton).filter(Boolean))
        .filter((row) => row.length > 0);
    } else {
      const rows: any[][] = [];
      for (let i = 0; i < menus.length; i += menusPerRow) {
        const row = menus
          .slice(i, i + menusPerRow)
          .map(buildButton)
          .filter(Boolean);
        if (row.length > 0) rows.push(row);
      }
      return rows;
    }
  };

  const rows = buildRows();
  if (rows.length === 0) return undefined;

  // 直接构造 InlineKeyboard，绕过 grammY 的逐个 add 校验
  const keyboard = new InlineKeyboard(rows);
  return keyboard;
};
