import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import GroupVerify from '../models/groupVerify';
import { RequestCustom } from '../types/user';

/**
 * 获取群验证列表
 */
const getGroupVerifies = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', botId, groupId } = req.query;

  const query: any = {};

  if (botId) {
    query.bot = botId;
  }

  if (groupId) {
    query.group = groupId;
  }

  const groupVerifies = await GroupVerify.find(query)
    .populate({
      path: 'group',
      select: 'id title username type',
    })
    .populate({
      path: 'bot',
      select: 'botName userName',
    })
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await GroupVerify.countDocuments(query).exec();

  res.json({
    success: true,
    data: groupVerifies,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

/**
 * 创建群验证配置
 */
const createGroupVerify = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { bot, group, question, asks, isActive = true } = req.body;

    if (!bot || !group || !question || !asks || asks.length === 0) {
      res.status(400);
      throw new Error('请提供完整的验证配置（bot、group、question、asks）');
    }

    // 检查该群组是否已有验证配置
    const existingVerify = await GroupVerify.findOne({ bot, group });
    if (existingVerify) {
      res.status(400);
      throw new Error('该群组已有验证配置，请先删除或编辑现有配置');
    }

    const groupVerify = await GroupVerify.create({
      bot,
      group,
      question,
      asks,
      isActive,
    });

    const populated = await GroupVerify.findById(groupVerify._id)
      .populate('group')
      .populate('bot');

    res.status(201).json({
      success: true,
      data: populated,
      message: '群验证配置创建成功',
    });
  },
);

/**
 * 更新群验证配置
 */
const updateGroupVerify = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { question, asks, isActive } = req.body;

  const groupVerify = await GroupVerify.findById(id);

  if (!groupVerify) {
    res.status(404);
    throw new Error('群验证配置不存在');
  }

  if (question !== undefined) groupVerify.question = question;
  if (asks !== undefined) groupVerify.asks = asks;
  if (isActive !== undefined) groupVerify.isActive = isActive;

  await groupVerify.save();

  const populated = await GroupVerify.findById(id)
    .populate('group')
    .populate('bot');

  res.json({
    success: true,
    data: populated,
    message: '群验证配置更新成功',
  });
});

/**
 * 删除群验证配置
 */
const deleteGroupVerify = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const groupVerify = await GroupVerify.findById(id);

  if (!groupVerify) {
    res.status(404);
    throw new Error('群验证配置不存在');
  }

  await GroupVerify.findByIdAndDelete(id);

  res.json({
    success: true,
    message: '群验证配置删除成功',
  });
});

export {
  getGroupVerifies,
  createGroupVerify,
  updateGroupVerify,
  deleteGroupVerify,
};
