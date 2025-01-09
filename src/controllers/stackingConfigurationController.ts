import { Request, Response } from 'express';
import StackingConfiguration from '../models/stackingConfiguration';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.investBalance) {
    query.investBalance = +queryParams.investBalance;
  }

  if (queryParams.rateOfReturn) {
    query.rateOfReturn = +queryParams.rateOfReturn;
  }

  return query;
};

// 获取所有叠加配置记录
const getStackingConfigurations = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    const stackingConfigurations = await StackingConfiguration.find(query)
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await StackingConfiguration.countDocuments(query).exec();

    res.json({
      success: true,
      data: stackingConfigurations,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加叠加配置记录
const addStackingConfiguration = handleAsync(
  async (req: Request, res: Response) => {
    const newStackingConfiguration = new StackingConfiguration({
      ...req.body,
    });

    const savedStackingConfiguration = await newStackingConfiguration.save();
    res.json({
      success: true,
      data: savedStackingConfiguration,
    });
  },
);

// 根据 ID 获取叠加配置记录
const getStackingConfigurationById = handleAsync(
  async (req: Request, res: Response) => {
    const stackingConfiguration = await StackingConfiguration.findById(
      req.params.id,
    );

    res.json({
      success: true,
      data: stackingConfiguration,
    });
  },
);

// 更新叠加配置记录
const updateStackingConfiguration = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const updatedStackingConfiguration =
      await StackingConfiguration.findByIdAndUpdate(
        id,
        { ...req.body },
        { new: true, runValidators: true },
      );

    res.json({
      success: true,
      data: updatedStackingConfiguration,
    });
  },
);

// 删除叠加配置记录
const deleteStackingConfiguration = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const stackingConfiguration =
      await StackingConfiguration.findByIdAndDelete(id);

    res.json({
      success: true,
      message: stackingConfiguration,
    });
  },
);

// 批量删除叠加配置记录
const deleteMultipleStackingConfigurations = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await StackingConfiguration.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} stacking configurations deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleStackingConfigurations,
  updateStackingConfiguration,
  deleteStackingConfiguration,
  getStackingConfigurations,
  addStackingConfiguration,
  getStackingConfigurationById,
};
