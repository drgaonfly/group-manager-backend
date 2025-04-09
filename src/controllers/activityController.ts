import { Request, Response } from 'express';
import Activity from '../models/activity';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import Customer from '../models/customer';
import ReleaseRecord from '../models/releaseRecord';
import User from '../models/user';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from 'user';
interface CustomRequest extends Request {
  user?: any; // Add user property to the request
}
// Helper function to build query
const buildActivityQuery = async (
  queryParams: any,
  req: CustomRequest,
): Promise<any> => {
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

  if (req.user && isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    const employeeInviteCodes = employees.map(
      (employee) => employee.inviteCode,
    );
    query.$or = [
      { user: { $in: [...employeeIds, req.user._id] } },
      { invitedBy: { $in: [...employeeInviteCodes, req.user.inviteCode] } },
    ];
  }

  return query;
};

// Get all activities
const getActivities = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildActivityQuery(req.query, req);

  const activities = await Activity.find(query)
    .populate('user')
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
const addActivity = handleAsync(async (req: CustomRequest, res: Response) => {
  const newId = await IdGen.next(Activity, 'id', 6); // Generate a 6-digit unique ID

  // Create the new activity with the generated id and user
  const newActivity = new Activity({
    ...req.body,
    id: newId, // Set the new unique id
    user: req.user._id, // Set the user who created the activity
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
  async (req: RequestCustom, res: Response) => {
    // 查找该用户的待处理活动
    const pendingActivity = await Activity.findOne({
      customer: req.customer._id,
      status: 'pending',
    }).populate('customer');

    if (!pendingActivity) {
      res.status(404);
      throw new Error('未找到待处理的活动');
    }

    res.json({
      success: true,
      data: pendingActivity,
    });
  },
);

// 更新活动状态并创建解押记录
const updateActivityAndCreateRelease = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { status, ethProfit, usdtAmount } = req.body;

    if (!status || !ethProfit || !usdtAmount) {
      res.status(400);
      throw new Error('地址、网络、状态、ETH收益和USDT金额参数都是必需的');
    }

    // 先找到对应的用户
    const customer = req.customer;

    // 查找并更新该用户的活动
    const activity = await Activity.findOneAndUpdate(
      {
        customer: customer._id,
        status: 'pending', // 确保只更新待处理的活动
      },
      {
        status: 'completed',
        participateTime: new Date(),
      },
      { new: true },
    );

    if (!activity) {
      res.status(404);
      throw new Error('未找到待处理的活动');
    }

    // 创建释放记录
    const releaseRecord = await ReleaseRecord.create({
      user: activity.user,
      customer: customer._id,
      activity: activity._id,
      chainName: customer.network,
      walletAddress: customer.address,
      applyTime: new Date(),
      status: 'pending',
      stakedUsdt: usdtAmount,
      rewardEth: ethProfit,
      lockDays: activity.lockDuration,
      releaseTime: activity.activityEndTime,
    });

    res.json({
      success: true,
      data: {
        activity,
        releaseRecord,
      },
      message: '活动状态更新成功并创建释放记录',
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
  updateActivityAndCreateRelease,
};
