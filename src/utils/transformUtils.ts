// src/utils/transformUtils.js
import { generateSignedUrl } from './generateSignedUrl'; // Ensure correct import path

// Function to transform image URLs for a given field in a given array of documents
export const transformDocumentImages = async (
  documents: any[],
  imageUrlFields: string | string[],
): Promise<any> => {
  return await Promise.all(
    documents.map(async (doc) => {
      // 判断 doc 是否有 toObject 方法
      const docObject = doc.toObject ? doc.toObject() : doc;

      // 如果 imageUrlFields 是字符串，将其转换为数组
      const fieldsArray = Array.isArray(imageUrlFields)
        ? imageUrlFields
        : [imageUrlFields];

      // 遍历所有的图片字段
      for (const imageUrlField of fieldsArray) {
        if (docObject[imageUrlField]) {
          docObject[imageUrlField] = await generateSignedUrl(
            docObject[imageUrlField],
          );
        }
      }

      return docObject;
    }),
  );
};

export const transformDocumentImage = async (
  doc: any,
  imageUrlFields: string | string[],
): Promise<any> => {
  // 判断 doc 是否有 toObject 方法
  const docObject = doc.toObject ? doc.toObject() : doc;

  // 如果 imageUrlFields 是字符串，将其转换为数组
  const fieldsArray = Array.isArray(imageUrlFields)
    ? imageUrlFields
    : [imageUrlFields];

  // 遍历所有的图片字段
  for (const imageUrlField of fieldsArray) {
    if (docObject[imageUrlField]) {
      docObject[imageUrlField] = await generateSignedUrl(
        docObject[imageUrlField],
      );
    }
  }

  return docObject;
};
