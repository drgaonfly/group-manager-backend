import { Request, Response } from 'express';
import Transaction from '../models/transaction';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { IBotUser } from '../models/botUser';
import { IBot } from '../models/bot';
import Group, { IGroup } from '../models/group';
import * as ExcelJS from 'exceljs';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.bot) {
    query.bot = queryParams.bot;
  }

  if (queryParams.to_user) {
    query.to_user = queryParams.to_user;
  }

  // 添加群组过滤条件
  if (queryParams.c) {
    query.group = queryParams.c;
  }

  return query;
};

// 构建日期过滤条件
const buildDateCondition = (dateFilter: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateFilter === 'today') {
    return { createdAt: { $gte: startOfDay } };
  }

  // 处理 day-1 到 day-6
  const dayMatch = dateFilter.match(/^day-(\d+)$/);
  if (dayMatch) {
    const daysAgo = parseInt(dayMatch[1], 10);
    if (daysAgo >= 1 && daysAgo <= 6) {
      return {
        createdAt: {
          $gte: new Date(startOfDay.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          $lt: new Date(
            startOfDay.getTime() - (daysAgo - 1) * 24 * 60 * 60 * 1000,
          ),
        },
      };
    }
  }

  // 默认返回空条件
  return {};
};

// 获取所有交易记录
const getTransactions = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const transactions = await Transaction.find(query)
    .populate('bot')
    .populate('botUser')
    .sort('-createdAt') // Sort by creation time in descending order
    .populate('group')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: transactions,
    total: await Transaction.countDocuments(query),
    current: +current,
    pageSize: +pageSize,
  });
});

// 根据 ID 获取交易记录
const getTransactionById = handleAsync(async (req: Request, res: Response) => {
  const transaction = await Transaction.findById(req.params.id).exec();

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: transaction,
  });
});

// 添加新交易记录
const addTransaction = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Transaction, 'id', 6);

  const newTransaction = new Transaction({
    ...req.body,
    id: newId,
  });

  const savedTransaction = await newTransaction.save();

  res.json({
    success: true,
    data: savedTransaction,
  });
});

// 更新交易记录
const updateTransaction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedTransaction = await Transaction.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedTransaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: updatedTransaction,
  });
});

// 删除交易记录
const deleteTransaction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transaction = await Transaction.findByIdAndDelete(id).exec();

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: { message: 'Transaction deleted successfully' },
  });
});

// 批量删除交易记录
const deleteMultipleTransactions = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Transaction.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} transactions deleted successfully`,
    });
  },
);

// export const getFilteredTransactions = handleAsync(
//   async (req: Request, res: Response) => {
//     const { type } = req.query;

//     // Build query based on type parameter
//     const query: any = {};
//     if (type === 'exchange_rate') {
//       query.exchange_rate = { $exists: true };
//     } else if (type === 'fee_rate') {
//       query.fee_rate = { $exists: true };
//     } else {
//       res.json({
//         success: true,
//         data: [],
//       });
//     }
//     // Execute query with type filter
//     const transactions = await Transaction.find(query)
//       .sort('-createdAt')
//       .lean()
//       .exec();

//     res.json({
//       success: true,
//       data: transactions,
//     });
//   },
// );

// 根据日期获取交易记录

const getTransactionByDate = handleAsync(
  async (req: Request, res: Response) => {
    const { dateFilter, current, pageSize, groupId, type } = req.query;

    const group_id = Number(groupId);

    const group = await Group.findOne({
      id: group_id,
    });

    // 构建日期过滤条件
    const dateCondition = buildDateCondition(dateFilter as string);

    // 基础查询条件
    const baseQuery = {
      ...dateCondition,
      group: group,
    };

    // 获取过滤后的交易记录，带分页
    const transactions = await Transaction.find({
      ...baseQuery,
      type: type,
    })
      .populate('botUser')
      .populate('group')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    // 获取真实的总记录数
    const total = transactions.length;

    // 并行获取计数
    const [deposit_total, withdraw_total] = await Promise.all([
      Transaction.countDocuments({ ...baseQuery, type: 'deposit' }),
      Transaction.countDocuments({ ...baseQuery, type: 'withdraw' }),
    ]);

    res.json({
      success: true,
      data: transactions,
      deposit_total,
      withdraw_total,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

const getSummary = handleAsync(async (req: Request, res: Response) => {
  const { dateFilter, groupId } = req.query;

  const group_id = Number(groupId);

  const group = await Group.findOne({
    id: group_id,
  });

  // 构建日期过滤条件
  const dateCondition = buildDateCondition(dateFilter as string);

  // // 获取所有交易记录
  // const transactions = await Transaction.find({
  //   ...dateCondition,
  //   group: group
  // })

  // 计算汇总数据
  const depositTransactions = await Transaction.find({
    ...dateCondition,
    group: group,
    type: 'deposit',
  });

  const withdrawTransactions = await Transaction.find({
    ...dateCondition,
    group: group,
    type: 'withdraw',
  });

  const totalDeposit = depositTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );

  const totalWithdraw = withdrawTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );

  const expectedWithdraw = totalDeposit - (1 - group.fee_rate / 100);

  // 余额
  const balance = expectedWithdraw - totalWithdraw;

  res.json({
    success: true,
    data: {
      totalDeposit: totalDeposit,
      totalWithdraw: totalWithdraw,
      feeRate: group.fee_rate,
      usdRate: group.exchange_rate,
      expectedWithdraw,
      balance,
    },
  });
});

// 导出Excel数据
const exportToExcel = handleAsync(async (req: Request, res: Response) => {
  const { dateFilter, groupId } = req.query;

  const group_id = Number(groupId);

  // 构建日期过滤条件
  const dateCondition = buildDateCondition(dateFilter as string);

  // 获取过滤后的交易记录
  const transactions = await Transaction.find(dateCondition)
    .populate('bot')
    .populate('botUser')
    .populate('group')
    .sort('-createdAt')
    .exec();

  // 过滤出transactions中group.id 符合 c的记录
  const filteredTransactions = transactions.filter(
    (transaction) => (transaction.group as IGroup).id === group_id,
  );

  // 创建工作簿和工作表
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('交易记录');

  // 设置列头
  worksheet.columns = [
    { header: '时间', key: 'time' },
    { header: '类型', key: 'type' },
    { header: '金额', key: 'amount' },
    { header: '操作人', key: 'operator' },
    { header: '机器人', key: 'bot' },
  ];

  // 添加数据行
  filteredTransactions.forEach((transaction) => {
    worksheet.addRow({
      time: new Date(transaction.createdAt).toLocaleTimeString(),
      type: transaction.type === 'deposit' ? '入款' : '下发',
      amount: transaction.amount,
      operator: `${(transaction.botUser as IBotUser).userName}`,
      bot: (transaction.bot as IBot).botName,
    });
  });

  // 设置样式
  worksheet.getRow(1).font = { bold: true };
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // 设置响应头
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=transactions-${dateFilter || 'all'}.xlsx`,
  );

  // 写入响应
  await workbook.xlsx.write(res);
  res.end();
});

export {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteMultipleTransactions,
  getSummary,
  getTransactionByDate,
  exportToExcel,
};
