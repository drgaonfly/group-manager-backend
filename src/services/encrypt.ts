import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 使用AES加密替代HMAC
const algorithm = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// 定义需要加密的key列表
export const ENCRYPTEDKEYS = ['addressETHKey', 'addressBSCKey'];

export const encrypt = (code: string) => {
  const iv = randomBytes(16);
  const cipher = createCipheriv(
    algorithm,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv,
  );

  let encrypted = cipher.update(code, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

export const decrypt = (encrypted: string) => {
  try {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(
      algorithm,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv,
    );

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // 解密失败
    console.log('解密失败: ' + error.message);
    return encrypted;
  }
};
