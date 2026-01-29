/**
 * 时间窗口检查工具
 */

/**
 * 检查当前时间是否在发送时间窗口内
 * @param startAt 开始时间 (Date | string | undefined)
 * @param endAt 结束时间 (Date | string | undefined)
 * @returns boolean
 */
export function isWithinTimeWindow(
  startAt?: Date | string,
  endAt?: Date | string,
): boolean {
  const now = new Date();

  // 如果没有设置时间窗口，默认允许
  if (!startAt && !endAt) return true;

  // 如果只设置了开始时间，检查是否已过开始时间
  if (startAt && !endAt) {
    return now >= new Date(startAt);
  }

  // 如果只设置了结束时间，检查是否未过结束时间
  if (!startAt && endAt) {
    return now <= new Date(endAt);
  }

  // 两个都设置了，检查是否在窗口内
  return now >= new Date(startAt!) && now <= new Date(endAt!);
}

/**
 * 格式化时间窗口为可读字符串
 * @param startAt 开始时间
 * @param endAt 结束时间
 * @returns 格式化的字符串
 */
export function formatTimeWindow(
  startAt?: Date | string,
  endAt?: Date | string,
): string {
  const startStr = startAt
    ? new Date(startAt).toLocaleString('zh-CN')
    : '未设置';
  const endStr = endAt ? new Date(endAt).toLocaleString('zh-CN') : '未设置';
  return `${startStr} - ${endStr}`;
}
