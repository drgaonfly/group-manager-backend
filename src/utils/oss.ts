import OSS from 'ali-oss';
import dotenv from 'dotenv';
dotenv.config();

let ossClient: OSS | null = null;

// Check if required environment variables are set for OSS
if (process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET) {
  ossClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-hongkong',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'tasksystemtestnew',
    secure: true,
  });
} else {
  console.warn(
    'OSS credentials not found in environment variables. OSS client will not be initialized.',
  );
}

export default ossClient;
