import ossClient from "./oss";
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { IBill } from "../models/bill";

export const processExcelFile = async (ossKey: string): Promise<string> => {
  // 从OSS下载文件
  const tempDownloadPath = `/tmp/${ossKey.split('/').pop()}`;
  await ossClient.get(ossKey, tempDownloadPath);

  // 使用xlsx读取文件
  const workbook = XLSX.readFile(tempDownloadPath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // 添加新列
  const range = XLSX.utils.decode_range(worksheet['!ref']!);
  for (let C = range.e.c + 1; C <= range.e.c + 3; C++) {
    const address = XLSX.utils.encode_cell({r: 0, c: C}); // 第一行，新列
    worksheet[address] = {t: 's', v: `新列${C-range.e.c}`}; // 添加列名
  }
  range.e.c += 3; // 扩展范围以包含新列
  worksheet['!ref'] = XLSX.utils.encode_range(range);

  // 写回修改后的文件
  XLSX.writeFile(workbook, tempDownloadPath);

  // 上传修改后的文件到OSS
  const newOssKey = `modified-${ossKey}`;
  await ossClient.put(newOssKey, tempDownloadPath);

  // 清理临时文件
  fs.unlinkSync(tempDownloadPath);

  return newOssKey; // 返回新文件在OSS上的路径
};

export const handleExcelTask = async (ossKey: string): Promise<string> => {
  const tempDownloadPath = path.join('/tmp', path.basename(ossKey));

  try {
   // Download the file from OSS to the temporary directory
   const result = await ossClient.get(ossKey, tempDownloadPath);

   // Check if the file was downloaded successfully
   if (result.res.status !== 200) {
     throw new Error('Failed to download the file from OSS');
   }

    // Initialize a new workbook and read the existing Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempDownloadPath);

    // Create a new worksheet with headers
    const newSheet = workbook.addWorksheet('New Data Sheet');
    newSheet.columns = [
      { header: '店铺名字', key: 'storeName', width: 15 },
      { header: '订单号', key: 'orderNumber', width: 15 },
      { header: '金额', key: 'amount', width: 10 },
      { header: '买手号', key: 'buyerId', width: 15 }
    ];

    // Add a row directly below the headers
    // newSheet.addRow({ storeName: 'Store A', orderNumber: '1001', amount: 200, buyerId: 'B001' });

    // Write the workbook to a buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Upload the modified file to OSS
    const newOssKey = `modified-${ossKey}`;
    await ossClient.put(newOssKey, buffer);

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return newOssKey; // Return the new file's OSS path
  } catch (error) {
    console.error("Error handling Excel task:", error);
    // Ensure cleanup even in the case of an error
    if (fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }
    throw new Error('Failed to process Excel file');
  }
};

export async function readExcelData(ossKey: string): Promise<IBill[]> {
  const tempDownloadPath = path.join('/tmp', path.basename(ossKey));

  try {
    // Download the file from OSS to the temporary directory
    const result = await ossClient.get(ossKey, tempDownloadPath);

    // Check if the file was downloaded successfully
    if (result.res.status !== 200) {
      throw new Error('Failed to download the file from OSS');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempDownloadPath);

    // Ensure the worksheet exists
    const worksheet = workbook.getWorksheet('New Data Sheet');
    if (!worksheet) {
      throw new Error('Worksheet "New Data Sheet" not found');
    }

    const bills: IBill[] = [];

    // Start reading from the second row, assuming the first row contains headers
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const bill: IBill = {
          storeName: row.getCell('店铺名字').text,
          orderNumber: row.getCell('订单号').text,
          amount: +row.getCell('金额').value,
          buyerId: row.getCell('买手号').text,
        };
        bills.push(bill);
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return bills;
  } catch (error) {
    console.error("Error reading Excel data:", error);
    // Ensure cleanup even in the case of an error
    if (fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }
    throw error;
  }
}