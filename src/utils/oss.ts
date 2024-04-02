import OSS from 'ali-oss';
import dotenv from 'dotenv';
dotenv.config();

const ossClient = new OSS({
  // 使用内网 endpoint
  // endpoint: process.env.OSS_ENDPOINT, // 例如: oss-cn-hangzhou-internal.aliyuncs.com
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  secure: true, // 使用 HTTPS
  internal: process.env.OSS_INTERNAL === 'true'
});

export default ossClient;