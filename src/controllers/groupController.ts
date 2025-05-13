import { Request, Response } from 'express';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

// 构建查询参数
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // title
  if (queryParams.title) {
    query.title = queryParams.title;
  }

  return query;
};

// 获取所有群组
const getGroups = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const groups = await Group.find(query)
    .populate('bot')
    .populate('creator')
    .populate('operators')
    .populate('botUsers')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: groups,
  });
});

// 获取群组详情
const getGroupById = handleAsync(async (req: Request, res: Response) => {
  const group = await Group.findById(req.params.id)
    .populate('bot')
    .populate('creator')
    .populate('operators')
    .exec();

  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: group,
  });
});

// 添加新群组
const addGroup = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Group, 'id', 6);

  const newGroup = new Group({
    ...req.body,
    id: newId,
  });

  const savedGroup = await newGroup.save();

  res.json({
    success: true,
    data: savedGroup,
  });
});

// 更新群组
const updateGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedGroup = await Group.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedGroup) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: updatedGroup,
  });
});

// 删除群组
const deleteGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const group = await Group.findByIdAndDelete(id).exec();

  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  res.json({
    success: true,
    data: { message: 'Group deleted successfully' },
  });
});

// 批量删除群组
const deleteMultipleGroups = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Group.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} groups deleted successfully`,
    });
  },
);

export {
  getGroups,
  getGroupById,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteMultipleGroups,
};
