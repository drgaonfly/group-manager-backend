import { Request, Response } from 'express';
import Notice from '../models/notice';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

interface CustomRequest extends Request {
  user?: any; // Add user property to the request
}

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.title) {
    query.title = { $regex: new RegExp(queryParams.title, 'i') };
  }

  if (queryParams.type) {
    query.type = { $regex: new RegExp(queryParams.type, 'i') };
  }

  return query;
};

// 获取所有通知记录
const getNotices = handleAsync(async (req: CustomRequest, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const notices = await Notice.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Notice.countDocuments(query).exec();

  res.json({
    success: true,
    data: notices,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加通知记录
const addNotice = handleAsync(async (req: CustomRequest, res: Response) => {
  const newId = await IdGen.next(Notice, 'id', 4);

  const newNotice = new Notice({
    ...req.body,
    creator: req.user.name,
    id: newId,
  });

  const savedNotice = await newNotice.save();
  res.json({
    success: true,
    data: savedNotice,
  });
});

// 根据 ID 获取通知记录
const getNoticeById = handleAsync(async (req: CustomRequest, res: Response) => {
  const notice = await Notice.findById(req.params.id).populate('customer');

  res.json({
    success: true,
    data: notice,
  });
});

// 更新通知记录
const updateNotice = handleAsync(async (req: CustomRequest, res: Response) => {
  const { id } = req.params;

  const updatedNotice = await Notice.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedNotice,
  });
});

// 删除通知记录
const deleteNotice = handleAsync(async (req: CustomRequest, res: Response) => {
  const { id } = req.params;

  const notice = await Notice.findByIdAndDelete(id);

  res.json({
    success: true,
    message: notice,
  });
});

// 批量删除通知记录
const deleteMultipleNotices = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { ids } = req.body;

    await Notice.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} notices deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleNotices,
  updateNotice,
  deleteNotice,
  getNotices,
  addNotice,
  getNoticeById,
};
