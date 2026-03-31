/*
 * DEPRECATED: This file has been moved to logger.ts middleware
 * All uploadProfile processing logic is now handled in the logger middleware
 * This file is kept for reference only and is not being used
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const DOWNLOAD_RETRY_TIMES = 3;
const DOWNLOAD_RETRY_INTERVAL_MS = 800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tmpDir = path.join(process.cwd(), 'tmp');

export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  savePath = tmpDir,
): Promise<string | null> {
  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_TIMES; attempt++) {
    try {
      // 获取文件信息
      const fileInfoResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      );
      const fileInfo = await fileInfoResponse.json();

      if (!fileInfo.ok || !fileInfo.result.file_path) {
        console.log('Failed to get file info:', fileInfo);
        return null;
      }

      const filePath = fileInfo.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      const fileExtension = path.extname(filePath);
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}${fileExtension}`;
      const fullPath = path.join(savePath, fileName);

      // 确保目录存在
      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true });
      }

      // 下载文件
      const downloaded = await new Promise<string>((resolve, reject) => {
        const file = fs.createWriteStream(fullPath);
        https
          .get(fileUrl, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve(fileName);
            });
          })
          .on('error', (err) => {
            fs.unlink(fullPath, () => {});
            reject(err);
          });
      });

      return downloaded;
    } catch (error) {
      const isLastAttempt = attempt === DOWNLOAD_RETRY_TIMES;
      console.log(
        `[下载失败] fileId=${fileId} attempt=${attempt}/${DOWNLOAD_RETRY_TIMES}`,
        error,
      );
      if (isLastAttempt) {
        console.error(`[下载失败] fileId=${fileId}，重试后仍失败`, error);
        return null;
      }
      await sleep(DOWNLOAD_RETRY_INTERVAL_MS * attempt);
    }
  }

  return null;
}
