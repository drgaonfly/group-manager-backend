// utils/generateSignedUrl.ts
import s3 from './s3'; // Assuming your S3 instance is configured here
import ossClient from '../utils/oss'; // 假设你的 OSS 客户端配置在这里

/**
 * Generates a signed URL for accessing a file stored in an S3 bucket.
 * @param filePath The file path (key) within the S3 bucket.
 * @param bucketName The name of the S3 bucket.
 * @returns A promise that resolves to the signed URL.
 */
export async function generateSignedUrlForS3(filePath: string): Promise<string> {
  try {
    const signedUrlParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filePath,
      Expires: 3600, // URL expiration time in seconds (e.g., 1 hour)
    };

    // Generate the signed URL
    const signedURL = await s3.getSignedUrlPromise('getObject', signedUrlParams);
    return signedURL;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error; // Rethrowing the error is usually better for error handling.
  }
}

// utils/generateSignedUrl.ts

/**
 * Generates a signed URL for the given file path.
 * @param filePath The file path in the OSS bucket.
 * @returns A promise that resolves to the signed URL.
 */
export async function generateSignedUrlForOSS(filePath: string): Promise<string> {
  try {
    const signedUrl = await ossClient.signatureUrl(filePath, {
      expires: 3600, // 设置URL的过期时间，例如1小时
      method: 'GET'
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return '';
  }
}

export async function generateSignedUrl(filePath: string): Promise<string> {
  return generateSignedUrlForOSS(filePath);
}