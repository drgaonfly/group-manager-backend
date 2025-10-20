import { Request, Response } from 'express';
import GroupMessage from '../models/groupMessage';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import Group from '../models/group';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from 'user';

// 构建查询参数
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
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

  if (queryParams.isOnline !== '') {
    query.isOnline = queryParams.isOnline === 'true';
  }

  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  return query;
};

// 获取所有群消息
const getGroupMessages = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const groupMessages = await GroupMessage.find(query)
      .populate({
        path: 'bot',
        populate: 'groups',
      })
      .populate('proxy')
      .populate('groups')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await GroupMessage.countDocuments(query).exec();

    // Convert Mongoose documents to plain objects and process images
    const processedGroupMessages = await Promise.all(
      groupMessages.map(async (gm) => {
        // Convert to plain JS object to avoid Mongoose internals in response
        const doc = gm.toObject ? gm.toObject() : gm;

        // If images array exists, process each image URL in the array
        if (doc.images && Array.isArray(doc.images)) {
          doc.images = await Promise.all(
            doc.images.map(async (imageUrl) => {
              return await generateSignedUrl(imageUrl);
            }),
          );
        }

        return doc;
      }),
    );

    res.json({
      success: true,
      data: processedGroupMessages,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

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
const addGroupMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const newGroupMessage = new GroupMessage({
      ...req.body,
      proxy: req.user._id,
    });

    const savedGroupMessage = await newGroupMessage.save();

    res.json({
      success: true,
      data: savedGroupMessage,
    });
  },
);

// 更新群消息
const updateGroupMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { images, ...otherFields } = req.body;

  // 构建更新对象
  const updates: any = {
    ...otherFields,
  };

  // 如果是已存在的URL（以http开头），则不更新，因为它已经在数据库中。

  // 处理 images 字段，只保留新的或空的图片路径，否则保留原有的 images
  if (Array.isArray(images)) {
    updates.images = images.filter(
      (image) => image === '' || (image && !image.startsWith('http')),
    );
    // 如果全部都是已存在的URL，则保留原有 images，不更新
    if (updates.images.length === 0) {
      delete updates.images;
    }
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
