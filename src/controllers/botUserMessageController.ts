import { Request, Response } from 'express';
import BotUserMessage from '../models/botUserMessage';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import BotUser from '../models/botUser';
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

  if (queryParams.botUser) {
    const botUserData = await BotUser.find({
      $or: [
        { userName: { $regex: queryParams.botUser, $options: 'i' } },
        { firstName: { $regex: queryParams.botUser, $options: 'i' } },
        { lastName: { $regex: queryParams.botUser, $options: 'i' } },
        { id: { $regex: queryParams.botUser, $options: 'i' } },
      ],
    });

    if (botUserData && botUserData.length > 0) {
      query.botUsers = { $in: botUserData.map((user) => user._id) };
    } else {
      query.botUsers = null;
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

// 获取所有 BotUser 消息
const getBotUserMessages = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const botUserMessages = await BotUserMessage.find(query)
      .populate('bot')
      .populate('proxy')
      .populate('botUsers')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await BotUserMessage.countDocuments(query).exec();

    const processedBotUserMessages = await Promise.all(
      botUserMessages.map(async (gm) => {
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
      data: processedBotUserMessages,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 获取 BotUser 消息详情
const getBotUserMessageById = handleAsync(
  async (req: Request, res: Response) => {
    const botUserMessage = await BotUserMessage.findById(req.params.id)
      .populate('bot')
      .populate('botUsers')
      .exec();

    if (!botUserMessage) {
      res.status(404);
      throw new Error('Bot user message not found');
    }

    res.json({
      success: true,
      data: botUserMessage,
    });
  },
);

// 添加新 BotUser 消息
const addBotUserMessage = handleAsync(async (req: Request, res: Response) => {
  const newBotUserMessage = new BotUserMessage({
    ...req.body,
  });

  const savedBotUserMessage = await newBotUserMessage.save();

  res.json({
    success: true,
    data: savedBotUserMessage,
  });
});

// 更新 BotUser 消息
const updateBotUserMessage = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { images, ...otherFields } = req.body;

    // 构建更新对象
    const updates: any = {
      ...otherFields,
    };

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

    const updatedBotUserMessage = await BotUserMessage.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true },
    ).exec();

    if (!updatedBotUserMessage) {
      res.status(404);
      throw new Error('Bot user message not found');
    }

    res.json({
      success: true,
      data: updatedBotUserMessage,
    });
  },
);

// 删除 BotUser 消息
const deleteBotUserMessage = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const botUserMessage = await BotUserMessage.findByIdAndDelete(id).exec();

    if (!botUserMessage) {
      res.status(404);
      throw new Error('Bot user message not found');
    }

    res.json({
      success: true,
      data: { message: 'Bot user message deleted successfully' },
    });
  },
);

// 批量删除 BotUser 消息
const deleteMultipleBotUserMessages = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await BotUserMessage.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} bot user messages deleted successfully`,
    });
  },
);

export {
  getBotUserMessages,
  getBotUserMessageById,
  addBotUserMessage,
  updateBotUserMessage,
  deleteBotUserMessage,
  deleteMultipleBotUserMessages,
};
