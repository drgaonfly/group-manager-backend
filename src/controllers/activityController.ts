import { Request, Response } from 'express';
import Activity from '../models/activity';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import Customer from '../models/customer';

// Helper function to build query
const buildActivityQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  if (queryParams.user) {
    query.user = queryParams.user;
  }

  return query;
};

// Get all activities
const getActivities = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildActivityQuery(req.query);

  const activities = await Activity.find(query)
    .populate('customer')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Activity.countDocuments(query).exec();

  res.json({
    success: true,
    data: activities,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a new activity
// Add a new activity
const addActivity = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Activity, 'id', 6); // Generate a 6-digit unique ID

  // Create the new activity with the generated id
  const newActivity = new Activity({
    ...req.body,
    id: newId, // Set the new unique id
  });

  // Save the new activity
  const savedActivity = await newActivity.save();

  res.json({
    success: true,
    data: savedActivity,
  });
});

// Get activity by ID
const getActivityById = handleAsync(async (req: Request, res: Response) => {
  const activity = await Activity.findById(req.params.id).populate('user');

  if (!activity) {
    res.status(404);
    throw new Error('Activity not found');
  }

  res.json({
    success: true,
    data: activity,
  });
});

// Update activity
const updateActivity = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedActivity = await Activity.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).populate('user');

  if (!updatedActivity) {
    res.status(404);
    throw new Error('Activity not found');
  }

  res.json({
    success: true,
    data: updatedActivity,
  });
});

// Delete activity
const deleteActivity = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const activity = await Activity.findByIdAndDelete(id);

  if (!activity) {
    res.status(404);
    throw new Error('Activity not found');
  }

  res.json({
    success: true,
    data: { message: 'Activity deleted successfully' },
  });
});

// Batch delete activities
const deleteMultipleActivities = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Activity.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} activities deleted successfully`,
    });
  },
);

// 根据地址和网络获取待处理的活动
const getPendingActivityByAddress = handleAsync(
  async (req: Request, res: Response) => {
    const { address, network } = req.query;

    if (!address || !network) {
      res.status(400).json({
        success: false,
        message: '地址和网络参数都是必需的',
      });
      return;
    }

    // 先找到对应的用户
    const customer = await Customer.findOne({ address, network });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: '未找到该用户',
      });
      return;
    }

    // 查找该用户的待处理活动
    const pendingActivity = await Activity.findOne({
      customer: customer._id,
      status: 'pending',
    }).populate('customer');

    if (!pendingActivity) {
      res.status(404).json({
        success: false,
        message: '未找到待处理的活动',
      });
      return;
    }

    res.json({
      success: true,
      data: pendingActivity,
    });
  },
);

export {
  getActivities,
  addActivity,
  getActivityById,
  updateActivity,
  deleteActivity,
  deleteMultipleActivities,
  getPendingActivityByAddress,
};
