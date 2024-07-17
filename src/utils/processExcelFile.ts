import ossClient from "./oss";
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { IBill } from "../models/bill";
import { IAccountLibrary } from "../models/accountLibrary";
import { IPriceList, IUser } from "../models/user";
import { reversedCountryCodeMapping } from "../constants";

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
    const workbook = XLSX.readFile(tempDownloadPath);

    // Create a new worksheet with headers
    const wsData = [
      ['店铺名字', '订单号', '金额', '买手号'],
    ];
    const newSheet = XLSX.utils.aoa_to_sheet(wsData);
    const newSheetName = 'New Data Sheet';
    workbook.SheetNames.push(newSheetName);
    workbook.Sheets[newSheetName] = newSheet;

    // Write the workbook to a new file
    const newFilePath = path.join('/tmp', `modified-${path.basename(ossKey)}`);
    XLSX.writeFile(workbook, newFilePath);

    // Upload the modified file to OSS
    const buffer = fs.readFileSync(newFilePath);
    const newOssKey = `modified-${ossKey}`;
    await ossClient.put(newOssKey, buffer);

    // Clean up the temporary files
    fs.unlinkSync(tempDownloadPath);
    fs.unlinkSync(newFilePath);

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
  try {
    const result = await ossClient.getStream(ossKey);
    const stream = result.stream;

    if (result.res.status !== 200) {
      throw new Error('Failed to download the file from OSS');
    }

    const options = {
      worksheets: 'emit' as const, // Change the value to either "emit" or "ignore"
    };
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(stream, options);
    const bills: IBill[] = [];
    let worksheetCounter = 0;

    return new Promise((resolve, reject) => {
      workbookReader.on('worksheet', (worksheet: any) => {
        worksheetCounter++;
        if (worksheetCounter !== 2) {
          return;
        }

        worksheet.on('row', (row: any) => {
          if (row.number > 1) {
            const country = row.getCell(1).value?.toString().trim();
            const taskSheet = row.getCell(2).value?.toString().trim();
            const storeName = row.getCell(3).value?.toString().trim();
            const date = row.getCell(4).value?.toString().trim();
            const remark = row.getCell(5).value?.toString().trim();
            const orderNumber = row.getCell(6).value?.toString().trim();
            const amount = typeof row.getCell(7).value === 'number' ? row.getCell(7).value : 0;
            let buyerId = '';
            const buyerIdCellValue = row.getCell(8).value;
            if (typeof buyerIdCellValue === 'object' && buyerIdCellValue?.richText) {
              buyerId = buyerIdCellValue.richText.map((item: any) => item.text).join('');
            } else if (typeof buyerIdCellValue === 'string') {
              buyerId = buyerIdCellValue.trim();
            }
            const customerCode = row.getCell(9).value?.toString().trim();

            console.dir(buyerId)

            console.log('storeName:', storeName);
            console.log('orderNumber:', orderNumber);
            console.log('amount:', amount);

            if (!country || !taskSheet || !storeName || !date || !orderNumber || amount === 0 || !buyerId || !customerCode) {
              return;
            }

            const bill: IBill = {
              country,
              taskSheet,
              storeName,
              date,
              remark,
              orderNumber,
              amount,
              buyerId,
              customerCode,
            } as IBill;
            bills.push(bill);
          }
        });
      });

      workbookReader.on('end', () => {
        resolve(bills);
      });

      workbookReader.on('error', (err: any) => {
        reject(err);
      });

      workbookReader.read();
    });
  } catch (error) {
    console.error("Error reading Excel data:", error);
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

export async function readAccountAssignmentRecordExcelData(ossKey: string): Promise<IAccountLibrary[]> {
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

    const records: IAccountLibrary[] = [];

    // Start reading from the second row, assuming the first row contains headers
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Assuming the first row is the header and actual data starts from the second row
      if (rowNumber > 1) {
        const record: IAccountLibrary = {
          country: row.getCell(1).text.trim(), // Country is in the first column
          platform: row.getCell(2).text.trim(), // Platform is in the second column
          accountNumber: row.getCell(3).text.trim(), // Account Number is in the third column
          loginAccount: row.getCell(4).text.trim(), // Login Account is in the fourth column
          loginPassword: row.getCell(5).text.trim(), // Login Password is in the fifth column
          accountAssignmentRecords: []
        } as unknown as IAccountLibrary;

        for (let i = 6; i < row.cellCount; i += 3) {
          if (row.getCell(i).text.trim() && row.getCell(i + 1).text.trim() && row.getCell(i + 2).text.trim()) {
            record.accountAssignmentRecords.push({
              storeAccount: row.getCell(i).text.trim(),
              assignedTime: row.getCell(i + 1).text.trim(),
              username: row.getCell(i + 2).text.trim(),
            });
          }
        }

        records.push(record);
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempDownloadPath);

    return records;
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
          const countryInExcel = row.getCell(2).text.trim();
          const countryInEnglish = reversedCountryCodeMapping[countryInExcel];


          const priceList: IPriceList = {
            country: countryInEnglish, // Country is in the second column
            exchangeRate: parseFloat(row.getCell(3).text.trim()), // Exchange rate is in the third column
            serviceFee: parseFloat(row.getCell(4).text.trim()), // Service fee is in the fourth column
            emptyPackageFee: parseFloat(row.getCell(5).text.trim()), // Service fee is in the fourth column
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