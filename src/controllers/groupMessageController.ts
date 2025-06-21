import { Request, Response } from 'express';
import GroupMessage from '../models/groupMessage';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import Group from '../models/group';

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
    .populate('bot')
    .populate('groups')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await GroupMessage.countDocuments(query).exec();

  res.json({
    success: true,
    data: groupMessages,
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

  const updatedGroupMessage = await GroupMessage.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedGroupMessage) {
    res.status(404);
    throw new Error('Group message not found');
  }

  res.json({
    success: true,
    data: updatedGroupMessage,
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
