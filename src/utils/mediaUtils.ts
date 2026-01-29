/**
 * 根据文件扩展名判断媒体类型
 * @param filename 文件名
 * @returns 'photo' | 'video'
 */
export const getMediaType = (filename: string): 'photo' | 'video' => {
  const ext = filename.toLowerCase().split('.').pop();
  const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
  return videoExtensions.includes(ext || '') ? 'video' : 'photo';
};
