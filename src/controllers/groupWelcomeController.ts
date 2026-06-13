import { Request, Response } from 'express';
import GroupWelcome from '../models/groupWelcome';
import Bot from '../models/bot';
import Group from '../models/group';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';

/**
 * 处理 groupWelcome 中 medias 的 signed URL
 */
const processMedias = async (welcomeObj: any) => {
  if (welcomeObj?.medias && Array.isArray(welcomeObj.medias)) {
    welcomeObj.medias = await Promise.all(
      welcomeObj.medias.map(async (url: string) => {
        if (url) return await generateSignedUrl(url);
        return url;
      }),
    );
  }
  return welcomeObj;
};

/**
 * 获取群欢迎配置列表（按 botId 查询）
 */
export const getGroupWelcomes = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, groupId, current = '1', pageSize = '50' } = req.query;

    const query: any = {};
    if (botId) query.bot = botId;
    if (groupId) query.group = groupId;

    const total = await GroupWelcome.countDocuments(query);
    const data = await GroupWelcome.find(query)
      .populate('group', 'title username id')
      .sort({ createdAt: -1 })
      .skip((Number(current) - 1) * Number(pageSize))
      .limit(Number(pageSize));

    const processed = await Promise.all(
      data.map(async (doc) => {
        const obj = doc.toObject();
        await processMedias(obj);
        return obj;
      }),
    );

    res.json({
      success: true,
      data: processed,
      total,
      current: Number(current),
      pageSize: Number(pageSize),
    });
  },
);

/**
 * 获取单条群欢迎配置
 */
export const getGroupWelcomeById = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await GroupWelcome.findById(req.params.id).populate(
      'group',
      'title username id',
    );

    if (!doc) {
      res.status(404);
      throw new Error('群欢迎配置不存在');
    }

    const obj = doc.toObject();
    await processMedias(obj);

    res.json({ success: true, data: obj });
  },
);

/**
 * 创建群欢迎配置
 */
export const createGroupWelcome = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const body = req.body;

    if (!body.bot) {
      res.status(400);
      throw new Error('缺少 bot 参数');
    }
    if (!body.group) {
      res.status(400);
      throw new Error('缺少 group 参数');
    }

    // 验证 bot 存在
    const bot = await Bot.findById(body.bot);
    if (!bot) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    // 验证 group 属于该 bot
    const group = await Group.findById(body.group);
    if (!group || !bot.groups.some((g: any) => g.toString() === body.group)) {
      res.status(400);
      throw new Error('指定的群组不属于该机器人');
    }

    // 检查是否已存在（唯一索引保障，这里给更友好的错误提示）
    const existing = await GroupWelcome.findOne({
      bot: body.bot,
      group: body.group,
    });
    if (existing) {
      res.status(400);
      throw new Error('该群组已存在欢迎配置，请直接编辑');
    }

    const rawMenus = Array.isArray(body.menus) ? body.menus : [];
    const validMenus = rawMenus.filter(
      (m: any) =>
        m &&
        typeof m.name === 'string' &&
        typeof m.url === 'string' &&
        m.name.trim() &&
        m.url.trim(),
    );

    const doc = await GroupWelcome.create({
      bot: body.bot,
      group: body.group,
      contents: Array.isArray(body.contents) ? body.contents : [],
      caption: body.caption ?? '',
      medias: Array.isArray(body.medias) ? body.medias : [],
      menus: validMenus,
      deleteAfterSeconds:
        typeof body.deleteAfterSeconds === 'number'
          ? body.deleteAfterSeconds
          : 0,
      pinNewMember:
        typeof body.pinNewMember === 'boolean' ? body.pinNewMember : false,
    });

    const populated = await GroupWelcome.findById(doc._id).populate(
      'group',
      'title username id',
    );
    const obj = populated!.toObject();
    await processMedias(obj);

    res
      .status(201)
      .json({ success: true, data: obj, message: '群欢迎配置创建成功' });
  },
);

/**
 * 更新群欢迎配置
 */
export const updateGroupWelcome = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    const doc = await GroupWelcome.findById(id);
    if (!doc) {
      res.status(404);
      throw new Error('群欢迎配置不存在');
    }

    const rawMenus = Array.isArray(body.menus) ? body.menus : [];
    const validMenus = rawMenus.filter(
      (m: any) =>
        m &&
        typeof m.name === 'string' &&
        typeof m.url === 'string' &&
        m.name.trim() &&
        m.url.trim(),
    );

    const updated = await GroupWelcome.findByIdAndUpdate(
      id,
      {
        $set: {
          contents: Array.isArray(body.contents) ? body.contents : doc.contents,
          caption: body.caption ?? doc.caption,
          medias: Array.isArray(body.medias) ? body.medias : doc.medias,
          menus: validMenus,
          deleteAfterSeconds:
            typeof body.deleteAfterSeconds === 'number'
              ? body.deleteAfterSeconds
              : doc.deleteAfterSeconds,
          pinNewMember:
            typeof body.pinNewMember === 'boolean'
              ? body.pinNewMember
              : doc.pinNewMember,
        },
      },
      { new: true, runValidators: true },
    ).populate('group', 'title username id');

    const obj = updated!.toObject();
    await processMedias(obj);

    res.json({ success: true, data: obj, message: '群欢迎配置更新成功' });
  },
);

/**
 * 删除群欢迎配置
 */
export const deleteGroupWelcome = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await GroupWelcome.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error('群欢迎配置不存在');
    }

    await GroupWelcome.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: '群欢迎配置删除成功' });
  },
);
