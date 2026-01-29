import { Request, Response } from 'express';
import ReplyRule from '../models/replyRule';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from 'user';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.botId) {
    query.bot = queryParams.botId;
  } else if (queryParams.bot) {
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

  if (queryParams.keyword) {
    query.keyword = { $regex: queryParams.keyword, $options: 'i' };
  }

  if (queryParams.content) {
    query.content = { $regex: queryParams.content, $options: 'i' };
  }

  if (
    queryParams.isOnline !== '' &&
    queryParams.isOnline !== undefined &&
    queryParams.isOnline !== null
  ) {
    query.isOnline =
      queryParams.isOnline === 'true' || queryParams.isOnline === true;
  }

  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  return query;
};

const getReplyRules = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const replyRules = await ReplyRule.find(query)
    .populate('bot')
    .populate('proxy')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await ReplyRule.countDocuments(query).exec();

  const processedReplyRules = await Promise.all(
    replyRules.map(async (replyRule) => {
      const doc = replyRule.toObject ? replyRule.toObject() : replyRule;

      if (doc.medias && Array.isArray(doc.medias)) {
        doc.medias = await Promise.all(
          doc.medias.map((mediaUrl) => generateSignedUrl(mediaUrl)),
        );
      }

      return doc;
    }),
  );

  res.json({
    success: true,
    data: processedReplyRules,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const getReplyRuleById = handleAsync(async (req: Request, res: Response) => {
  const replyRule = await ReplyRule.findById(req.params.id)
    .populate('bot')
    .exec();

  if (!replyRule) {
    res.status(404);
    throw new Error('ReplyRule not found');
  }

  const doc = replyRule.toObject ? replyRule.toObject() : replyRule;

  if (doc.medias && Array.isArray(doc.medias)) {
    doc.medias = await Promise.all(
      doc.medias.map((mediaUrl) => generateSignedUrl(mediaUrl)),
    );
  }

  res.json({
    success: true,
    data: doc,
  });
});

const addReplyRule = handleAsync(async (req: RequestCustom, res: Response) => {
  const body = req.body as any;

  const newReplyRule = new ReplyRule({
    ...body,
    keyword: Array.isArray(body.keyword) ? body.keyword : [body.keyword],
    proxy: req.user._id,
  });

  const savedReplyRule = await newReplyRule.save();

  res.json({
    success: true,
    data: savedReplyRule,
  });
});

const updateReplyRule = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { medias, ...otherFields } = req.body;

  const updates: any = {
    ...otherFields,
  };

  if (medias !== undefined && Array.isArray(medias)) {
    updates.medias = medias.filter(
      (media) => media === '' || (media && !media.startsWith('http')),
    );
    if (updates.medias.length === 0) {
      delete updates.medias;
    }
  }

  const updatedReplyRule = await ReplyRule.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).exec();

  if (!updatedReplyRule) {
    res.status(404);
    throw new Error('ReplyRule not found');
  }

  res.json({
    success: true,
    data: updatedReplyRule,
  });
});

const deleteReplyRule = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const replyRule = await ReplyRule.findByIdAndDelete(id).exec();

  if (!replyRule) {
    res.status(404);
    throw new Error('ReplyRule not found');
  }

  res.json({
    success: true,
    data: { message: 'ReplyRule deleted successfully' },
  });
});

const deleteMultipleReplyRules = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await ReplyRule.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} reply rules deleted successfully`,
    });
  },
);

export {
  getReplyRules,
  getReplyRuleById,
  addReplyRule,
  updateReplyRule,
  deleteReplyRule,
  deleteMultipleReplyRules,
};
