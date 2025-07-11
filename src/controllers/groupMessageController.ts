import { Request, Response } from 'express';
import GroupMessage from '../models/groupMessage';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import Group from '../models/group';
import { transformDocumentImages } from '../utils/transformUtils';

// 构建查询参数
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.bot) {
    const botData = await Bot.find({
      botName: {
        $regex: queryParams.bot,
        $options: 'i',
      },
    });

    if (botData && botData.length > 0) {
      query.bot = { $in: botData.map((bot) => bot._id) };
    } else {
      query.bot = null;
    }
  }

  if (queryParams.group) {
    const groupData = await Group.find({
      title: {
        $regex: queryParams.group,
        $options: 'i',
      },
    });

    if (groupData && groupData.length > 0) {
      query.group = { $in: groupData.map((group) => group._id) };
    } else {
      query.group = null;
    }
  }

  return query;
};

// 获取所有群消息
const getGroupMessages = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const groupMessages = await GroupMessage.find(query)
    .populate({
      path: 'bot',
      populate: 'groups',
    })
    .populate('groups')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await GroupMessage.countDocuments(query).exec();

  const processedGroupMessages = await transformDocumentImages(
    groupMessages,
    'image',
  );

  res.json({
    success: true,
    data: processedGroupMessages,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 获取群消息详情
const getGroupMessageById = handleAsync(async (req: Request, res: Response) => {
  const groupMessage = await GroupMessage.findById(req.params.id)
    .populate('bot')
    .populate('groups')
    .exec();

  if (!groupMessage) {
    res.status(404);
    throw new Error('Group message not found');
  }

  res.json({
    success: true,
    data: groupMessage,
  });
});

// 添加新群消息
const addGroupMessage = handleAsync(async (req: Request, res: Response) => {
  const newGroupMessage = new GroupMessage({
    ...req.body,
  });

  const savedGroupMessage = await newGroupMessage.save();

  res.json({
    success: true,
    data: savedGroupMessage,
  });
});

// 更新群消息
const updateGroupMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { image, ...otherFields } = req.body;

  // 构建更新对象
  const updates: any = {
    ...otherFields,
  };

  // 处理 image 字段
  // 如果 image 是空字符串或者是一个新的文件路径（不以http开头），则更新它。
  // 如果是已存在的URL（以http开头），则不更新，因为它已经在数据库中。
  if (image === '' || (image && !image.startsWith('http'))) {
    updates.image = image;
  }

  const updatedGroupMessage = await GroupMessage.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true },
  ).exec();

  if (!updatedGroupMessage) {
    res.status(404);
    throw new Error('Group message not found');
  }

  // 处理 image 路径
  // 假设有 transformDocumentImages 工具函数，和 getGroupMessages 一致
  const processedGroupMessageArr = await transformDocumentImages(
    [updatedGroupMessage],
    'image',
  );
  const processedGroupMessage = processedGroupMessageArr[0];

  res.json({
    success: true,
    data: processedGroupMessage,
  });
});

// 删除群消息
const deleteGroupMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const groupMessage = await GroupMessage.findByIdAndDelete(id).exec();

  if (!groupMessage) {
    res.status(404);
    throw new Error('Group message not found');
  }

  res.json({
    success: true,
    data: { message: 'Group message deleted successfully' },
  });
});

// 批量删除群消息
const deleteMultipleGroupMessages = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await GroupMessage.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} group messages deleted successfully`,
    });
  },
);

export {
  getGroupMessages,
  getGroupMessageById,
  addGroupMessage,
  updateGroupMessage,
  deleteGroupMessage,
  deleteMultipleGroupMessages,
};
