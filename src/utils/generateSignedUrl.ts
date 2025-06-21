// utils/generateSignedUrl.ts
import s3 from './s3'; // Assuming your S3 instance is configured here
import ossClient from '../utils/oss'; // 假设你的 OSS 客户端配置在这里

/**
 * Generates a signed URL for accessing a file stored in an S3 bucket.
 * @param filePath The file path (key) within the S3 bucket.
 * @param bucketName The name of the S3 bucket.
 * @returns A promise that resolves to the signed URL.
 */
export async function generateSignedUrlForS3(
  filePath: string,
  expires = 3600,
): Promise<string> {
  try {
    const signedUrlParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filePath,
      Expires: expires, // Use the provided expires value or the default value
    };

    // Generate the signed URL
    const signedURL = await s3.getSignedUrlPromise(
      'getObject',
      signedUrlParams,
    );
    return signedURL;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error; // Rethrowing the error is usually better for error handling.
  }
}

// utils/generateSignedUrl.ts

/**
 * Generates a signed URL for the given file path.
 * @param filePath The file path in the OSS bucket.
 * @returns A promise that resolves to the signed URL.
 */
export async function generateSignedUrlForOSS(
  filePath: string,
  expires = 3600,
): Promise<string> {
  try {
    const signedUrl = await ossClient.signatureUrl(filePath, {
      expires, // 使用传入的 expires 值或默认值
      method: 'GET',
    });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return '';
  }
}

export async function generateLocalSignedUrl(
  filePath: string,
): Promise<string> {
  return `${process.env.BACKEND_URL}/api/static/${filePath}`;
}

export async function generateSignedUrl(
  filePath: string,
  expires = 3600,
): Promise<string> {
  console.log('expires', expires);
  return generateLocalSignedUrl(filePath);
  // return generateSignedUrlForS3(filePath, expires);
}
