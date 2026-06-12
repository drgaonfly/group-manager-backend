import { Request, Response } from 'express';
import AdRemoval from '../models/adRemoval';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';

/**
 * 获取所有去除广告规则（支持分页和过滤）
 */
export const getAdRemovals = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10', name, isOnline, botId } = req.query;
    const query: any = {
      proxy: req.user._id, // 限制只能查看自己的规则库
    };

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    if (isOnline !== undefined && isOnline !== '') {
      query.isOnline = isOnline === 'true';
    }

    // 如果传了 botId，则只看关联到该机器人的规则（虽然逻辑上目前是一个库对应一个或多个机器人）
    if (botId) {
      query.bot = botId;
    }

    const adRemovals = await AdRemoval.find(query)
      .populate('group', 'title username')
      .sort('-priority -createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await AdRemoval.countDocuments(query);

    res.status(200).json({
      success: true,
      data: adRemovals,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

/**
 * 获取单个去除广告规则详情
 */
export const getAdRemovalById = handleAsync(
  async (req: Request, res: Response) => {
    const adRemoval = await AdRemoval.findById(req.params.id).populate(
      'group',
      'title username',
    );

    if (!adRemoval) {
      res.status(404);
      throw new Error('拦截规则不存在');
    }

    res.status(200).json({
      success: true,
      data: adRemoval,
    });
  },
);

/**
 * 添加去除广告规则
 */
export const addAdRemoval = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { bot, ...rest } = req.body;
    if (!bot) {
      res.status(400);
      throw new Error('机器人 ID 不能为空');
    }
    const adRemoval = new AdRemoval({
      bot,
      proxy: req.user._id, // 自动关联当前登录的代理账号
      ...rest,
    });
    const savedAdRemoval = await adRemoval.save();
    res.status(201).json({
      success: true,
      data: savedAdRemoval,
    });
  },
);

/**
 * 更新去除广告规则
 */
export const updateAdRemoval = handleAsync(
  async (req: Request, res: Response) => {
    const adRemoval = await AdRemoval.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    ).populate('group', 'title username');

    if (!adRemoval) {
      res.status(404);
      throw new Error('拦截规则不存在');
    }

    res.status(200).json({
      success: true,
      data: adRemoval,
    });
  },
);

/**
 * 删除去除广告规则
 */
export const deleteAdRemoval = handleAsync(
  async (req: Request, res: Response) => {
    const adRemoval = await AdRemoval.findByIdAndDelete(req.params.id);

    if (!adRemoval) {
      res.status(404);
      throw new Error('拦截规则不存在');
    }

    res.status(200).json({
      success: true,
      data: { message: '拦截规则删除成功' },
    });
  },
);

/**
 * 批量删除去除广告规则
 */
export const deleteMultipleAdRemovals = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的规则 ID 列表');
    }

    await AdRemoval.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `成功删除 ${ids.length} 个拦截规则`,
    });
  },
);
