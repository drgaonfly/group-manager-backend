import ossClient from "./oss";
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { IBill } from "../models/bill";
import { IAccountLibrary } from "../models/accountLibrary";
import { IPriceList, IUser } from "../models/user";
import { countryMapping } from "../constants";

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
    const address = XLSX.utils.encode_cell({ r: 0, c: C }); // 第一行，新列
    worksheet[address] = { t: 's', v: `新列${C - range.e.c}` }; // 添加列名
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
      // Assuming the first row is the header and actual data starts from the second row
      if (rowNumber > 1) {
        const bill: IBill = {
          storeName: row.getCell(1).text.trim(),    // '店铺名字' is in the first column
          orderNumber: row.getCell(2).text.trim(),  // '订单号' is in the second column
          amount: +row.getCell(3).value,     // '金额' is in the third column
          buyerId: row.getCell(4).text.trim(),      // '买手号' is in the fourth column
        } as IBill;
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

export async function readAccountExcelData(ossKey: string): Promise<IAccountLibrary[]> {
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
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Worksheet "New Data Sheet" not found');
    }

    const accounts: IAccountLibrary[] = [];

    // Start reading from the second row, assuming the first row contains headers
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Assuming the first row is the header and actual data starts from the second row
      if (rowNumber > 1) {
        const account: IAccountLibrary = {
          country: row.getCell(1).text.trim(),          // Country is in the first column
          platform: row.getCell(2).text.trim(),         // Platform is in the second column
          accountNumber: row.getCell(3).text.trim(),    // Account Number is in the fourth column
          loginAccount: row.getCell(4).text.trim(),     // Serial Number is in the fifth column
          loginPassword: row.getCell(5).text.trim(),     // Store Account is in the sixth column
        } as IAccountLibrary;
        accounts.push(account);
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return accounts;
  } catch (error) {
    console.error("Error reading Excel data:", error);
    // Ensure cleanup even in the case of an error
    if (fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }
    throw error;
  }
}

export async function readUserExcelData(ossKey: string): Promise<IUser[]> {
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
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Worksheet not found');
    }

    const users: IUser[] = [];

    // Start reading from the second row, assuming the first row contains headers
    const emailRegex = /[\w-.]+@([\w-]+\.)+[\w-]{2,4}/g;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Assuming the first row is the header and actual data starts from the second row
      if (rowNumber > 1) {
        const possibleEmail = String(row.getCell(1).text.trim()); // Ensure we are working with a string
        const match = possibleEmail.match(emailRegex);
        const email = match ? match[0].trim() : null; // Only take the first match and trim spaces

        if (email) {
          const user: IUser = {
            email: email, // Processed email
            name: row.getCell(2).text.trim(), // Username is in the second column
            password: row.getCell(3).text.trim(), // Password is in the third column
          } as IUser;
          users.push(user);
        }
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return users;
  } catch (error) {
    console.error("Error reading Excel data:", error);
    // Ensure cleanup even in the case of an error
    if (fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }
    throw error;
  }
}

export async function readPriceExcelData(ossKey: string): Promise<{ email: string, priceList: IPriceList[] }[]> {
  const tempDownloadPath = path.join('/tmp', path.basename(ossKey));
  const emailRegex = /[\w-.]+@([\w-]+\.)+[\w-]{2,4}/g;

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
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Worksheet not found');
    }

    // Start reading from the second row, assuming the first row contains headers
    const priceLists: { email: string; priceList: IPriceList[] }[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Assuming the first row is the header and actual data starts from the second row
      if (rowNumber > 1) {
        const possibleEmail = String(row.getCell(1).text.trim()); // Ensure we are working with a string
        const match = possibleEmail.match(emailRegex);
        const email = match ? match[0].trim() : null;


        if (email) {
          const countryInChinese = row.getCell(2).text.trim();
          let countryInEnglish = '';

          if (countryInChinese.includes('河内')) {
            countryInEnglish = countryMapping['越南河内'];
          } else if (countryInChinese.includes('胡志明')) {
            countryInEnglish = countryMapping['越南胡志明'];
          } else {
            countryInEnglish = countryMapping[countryInChinese];
          }
          const priceList: IPriceList = {
            country: countryInEnglish, // Country is in the second column
            exchangeRate: parseFloat(row.getCell(3).text.trim()), // Exchange rate is in the third column
            serviceFee: parseFloat(row.getCell(4).text.trim()), // Service fee is in the fourth column
          };

          // Check if the email already exists in the priceLists array
          const existingEntry = priceLists.find((entry) => entry.email === email);

          if (existingEntry) {
            // If the email already exists, push the new priceList to the existing array
            existingEntry.priceList.push(priceList);
          } else {
            // If the email does not exist, create a new entry
            priceLists.push({ email: email, priceList: [priceList] });
          }
        }
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return priceLists;
  } catch (error) {
    console.error("Error reading Excel data:", error);
    // Ensure cleanup even in the case of an error
    if (fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }
    throw error;
  }
}