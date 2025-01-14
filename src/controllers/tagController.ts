import { Request, Response } from 'express';
import Tag from '../models/tag';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.chainName) {
    query.chainName = queryParams.chainName;
  }

  if (queryParams.currency) {
    query.currency = queryParams.currency;
  }

  if (queryParams.transferType) {
    query.transferType = queryParams.transferType;
  }

  if (queryParams.fromAddress) {
    query.fromAddress = { $regex: new RegExp(queryParams.fromAddress, 'i') };
  }

  if (queryParams.toAddress) {
    query.toAddress = { $regex: new RegExp(queryParams.toAddress, 'i') };
  }

  return query;
};

const getTags = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const tags = await Tag.find(query)
    .populate('customer')
    .populate('proxy')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Tag.countDocuments(query).exec();

  res.json({
    success: true,
    data: tags,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addTag = handleAsync(async (req: Request, res: Response) => {
  const newTag = new Tag({
    ...req.body,
  });

  const savedTag = await newTag.save();
  res.json({
    success: true,
    data: savedTag,
  });
});

const getTagById = handleAsync(async (req: Request, res: Response) => {
  const tag = await Tag.findById(req.params.id)
    .populate('customer', 'name')
    .populate('proxy', 'name');

  res.json({
    success: true,
    data: tag,
  });
});

const updateTag = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedTag = await Tag.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedTag,
  });
});

const deleteTag = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const tag = await Tag.findByIdAndDelete(id);

  res.json({
    success: true,
    message: tag,
  });
});

const deleteMultipleTags = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  await Tag.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} tags deleted successfully`,
  });
});

export {
  getTags,
  addTag,
  getTagById,
  updateTag,
  deleteTag,
  deleteMultipleTags,
};
