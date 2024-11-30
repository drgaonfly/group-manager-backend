import { Request, Response } from 'express';
import Resume from '../models/resume';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.customer) {
    let searchText;
    try {
      const customerParam = JSON.parse(String(queryParams.customer));
      searchText = customerParam.username;
    } catch (e) {
      searchText = String(queryParams.customer).trim();
    }

    console.log('搜索文本:', searchText);

    const customerData = await Customer.find({
      username: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (customerData && customerData.length > 0) {
      query.customer = { $in: customerData.map((customer) => customer._id) };
      console.log('查询条件:', query.customer);
    } else {
      console.log('未找到匹配的客户');
      return null;
    }
  }

  if (queryParams.fullName) {
    query.fullName = { $regex: queryParams.fullName, $options: 'i' };
  }

  if (queryParams.location) {
    query.location = { $regex: queryParams.location, $options: 'i' };
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  if (queryParams.teachingLevel) {
    query.teachingLevel = queryParams.teachingLevel;
  }

  if (queryParams.subjects) {
    query.subjects = { $in: [queryParams.subjects] };
  }

  if (queryParams.teachingYears) {
    query.teachingYears = queryParams.teachingYears;
  }

  return query;
};

// 获取简历列表
const getResumes = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  if (query === null) {
    res.json({
      success: true,
      data: [],
      total: 0,
      current: +current,
      pageSize: +pageSize,
    });
    return;
  }

  const resumes = await Resume.find(query)
    .populate('customer', 'username _id')
    .sort('-lastUpdated')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Resume.countDocuments(query).exec();

  res.json({
    success: true,
    data: resumes,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新简历
const addResume = handleAsync(async (req: Request, res: Response) => {
  const { customer } = req.body;

  // 检查是否已存在该客户的简历
  const resumeExists = await Resume.findOne({ customer });
  if (resumeExists) {
    res.status(400);
    throw new Error('该客户已有简历');
  }

  const resume = await Resume.create({
    ...req.body,
    status: 'draft',
    lastUpdated: new Date(),
  });

  res.status(201).json({
    success: true,
    data: resume,
  });
});

// 获取单个简历
const getResumeById = handleAsync(async (req: Request, res: Response) => {
  const resume = await Resume.findById(req.params.id).populate(
    'customer',
    'username _id',
  );

  if (!resume) {
    res.status(404);
    throw new Error('简历不存在');
  }

  res.json({
    success: true,
    data: resume,
  });
});

// 更新简历
const updateResume = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const resume = await Resume.findById(id);
  if (!resume) {
    res.status(404);
    throw new Error('简历不存在');
  }

  const updatedResume = await Resume.findByIdAndUpdate(
    id,
    {
      ...req.body,
      lastUpdated: new Date(),
    },
    { new: true, runValidators: true },
  ).populate('customer', 'username _id');

  res.json({
    success: true,
    data: updatedResume,
  });
});

// 删除简历
const deleteResume = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const resume = await Resume.findByIdAndDelete(id);

  if (!resume) {
    res.status(404);
    throw new Error('简历不存在');
  }

  res.json({
    success: true,
    data: { message: '简历删除成功' },
  });
});

// 批量删除简历
const deleteMultipleResumes = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Resume.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 份简历`,
    });
  },
);

export {
  getResumes,
  addResume,
  getResumeById,
  updateResume,
  deleteResume,
  deleteMultipleResumes,
};
