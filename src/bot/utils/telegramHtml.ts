// 将 Quill HTML 转换为 Telegram 支持的 HTML
export const convertToTelegramHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/<strong>/g, '<b>')
    .replace(/<\/strong>/g, '</b>')
    .replace(/<em>/g, '<i>')
    .replace(/<\/em>/g, '</i>')
    .replace(/<s>/g, '<s>')
    .replace(/<\/s>/g, '</s>')
    .replace(/<pre class="ql-syntax" spellcheck="false">/g, '<pre>')
    .replace(/<\/pre>/g, '</pre>')
    .replace(/<blockquote>/g, '')
    .replace(/<\/blockquote>/g, '')
    .replace(/<ol>/g, '')
    .replace(/<\/ol>/g, '')
    .replace(/<ul>/g, '')
    .replace(/<\/ul>/g, '')
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<p><br><\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/^\s+/, '');
};
