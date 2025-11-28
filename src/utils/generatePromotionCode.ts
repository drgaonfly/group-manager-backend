import crypto from 'crypto';

/**
 * 生成推广链接随机码（6-8位字母）
 * @param length 码长度，默认7位（6-8位之间）
 * @returns 唯一的随机码
 */
export async function generatePromotionCode(
  length: number = 7,
  model: any,
): Promise<string> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 仅使用大写字母
  let promotionCode: string;

  do {
    // 生成随机码
    promotionCode = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, letters.length);
      promotionCode += letters[randomIndex];
    }
  } while (await model.findOne({ code: promotionCode }));

  return promotionCode;
}
