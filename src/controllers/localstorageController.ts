import { Request, Response } from 'express';

export const handleLocalStorageData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 从请求体中获取数据
    const localStorageData = req.body;

    // console.log(handleLocalStorageData);

    // 打印接收到的数据
    console.log('接收到的 localStorage 数据:', localStorageData);

    // 可以对数据进行进一步处理（如存储到数据库）
    // ...

    // 返回成功响应
    res.status(200).json({
      message: '数据接收成功',
      receivedData: localStorageData,
    });
  } catch (error) {
    console.error('处理数据时出错:', error);

    res.status(500).json({
      message: '服务器处理数据时出错',
      error: error.message,
    });
  }
};
