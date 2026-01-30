export function extractChannelTarget(url: string): string | null {
  if (!url) return null;

  // 处理 t.me/channelname 格式
  const telegramMatch = url.match(/t\.me\/([a-zA-Z0-9_]+)/);
  if (telegramMatch) {
    return `@${telegramMatch[1]}`;
  }

  // 处理直接的频道ID格式 (如 -1001234567890)
  const channelIdMatch = url.match(/^-?\d+$/);
  if (channelIdMatch) {
    return url;
  }

  // 处理 @channelname 格式
  const usernameMatch = url.match(/^@([a-zA-Z0-9_]+)$/);
  if (usernameMatch) {
    return url;
  }

  return null;
}
