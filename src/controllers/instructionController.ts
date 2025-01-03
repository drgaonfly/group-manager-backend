import { Request, Response } from 'express';
import Instruction from '../models/Instruction';
import handleAsync from '../utils/handleAsync';

// dataPermissionController.ts
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.title) {
    query.title = queryParams.title;
  }

  return query;
};

// 获取所有答案
const getInstructions = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const instructions = await Instruction.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Instruction.countDocuments(query).exec();

  res.json({
    success: true,
    data: instructions,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加答案
const addInstruction = handleAsync(async (req: Request, res: Response) => {
  const newInstruction = new Instruction({
    ...req.body,
  });

  const savedInstruction = await newInstruction.save();

  res.json({
    success: true,
    data: savedInstruction,
  });
});

// 根据ID获取答案
const getInstructionById = handleAsync(async (req: Request, res: Response) => {
  const instruction = await Instruction.findById(req.params.id);

  if (!instruction) {
    res.status(404);
    throw new Error('指令不存在');
  }

  res.json({
    success: true,
    data: instruction,
  });
});

// 更新答案
const updateInstruction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedInstruction = await Instruction.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  );

  if (!updatedInstruction) {
    res.status(404);
    throw new Error('Permission not found');
  }

  res.json({
    success: true,
    data: updatedInstruction,
  });
});

// 删除答案
const deleteInstruction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除答案
  const instruction = await Instruction.findByIdAndDelete(id);

  if (!instruction) {
    res.status(404);
    throw new Error('指令不存在');
  }

  res.json({
    success: true,
    data: { message: '指令删除成功' },
  });
});

// 批量删除答案1
const deleteMultipleInstructions = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Instruction.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} 指令删除成功`,
    });
  },
);

export {
  getInstructions,
  addInstruction,
  getInstructionById,
  updateInstruction,
  deleteInstruction,
  deleteMultipleInstructions,
};
