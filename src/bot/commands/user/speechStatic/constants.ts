// 发言统计分页大小
export const PAGE_SIZE = 10;

// 格式化用户显示名称（带 @userName 链接）
export const formatUserDisplay = (
  displayName: string,
  userName?: string,
): string => {
  if (userName) {
    return `<a href="https://t.me/${userName}">${displayName}</a>`;
  }
  return displayName;
};
