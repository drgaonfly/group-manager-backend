// controllers/userController.ts
import { Request, Response } from 'express';
import Employee from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from 'bcrypt';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
// import { Request } from '../types/express';

const getEmployees = handleAsync(async (req: RequestCustom, res: Response) => {
  const { email, name, live, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (email) {
    query.email = email;
  }

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (live) {
    query.live = live === 'true';
  }

  // 只显示当前代理的员工
  query.proxy = req.user._id;

  // 执行查询
  const users = await Employee.find({
    ...query,
  })
    .populate('proxy')
    .populate('roles')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Employee.countDocuments({
    ...query,
  }).exec();

  res.json({
    success: true,
    data: users.map((employee) => exclude(employee.toObject(), 'password')),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addEmployee = handleAsync(async (req: RequestCustom, res: Response) => {
  const { name, email, password, roles, proxy } = req.body;

  const userExists = await Employee.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('Employee already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const newUser = new Employee({
    name,
    email,
    roles,
    password: hashPassword,
    proxy,
  });

  const savedUser = await newUser.save();

  res.json({
    success: true,
    data: exclude(savedUser.toObject(), 'password'),
  });
});

const getEmployeeById = handleAsync(async (req: Request, res: Response) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  } else {
    res.json({
      success: true,
      data: exclude(employee.toObject(), 'password'),
    });
  }
});

const updateEmployee = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password, name, email, live, roles } = req.body;

  const employee = await Employee.findById(id);

  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }

  let hashPassword = employee.password;

  if (password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(password, salt);
  }

  const newRoles = roles ? roles : employee.roles;

  const updatedUser = await Employee.findByIdAndUpdate(
    id,
    {
      name,
      email,
      password: hashPassword,
      live,
      roles: newRoles,
    },
    { new: true },
  );

  res.json({
    success: true,
    data: updatedUser,
  });
});

const deleteEmployee = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除用户
  const employee = await Employee.findByIdAndDelete(id);

  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }

  res.json({
    success: true,
    data: { message: 'Employee deleted successfully' },
  });
});

const deleteMultipleEmployees = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Employee.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} users deleted successfully`,
    });
  },
);

export {
  deleteMultipleEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployees,
  addEmployee,
  getEmployeeById,
};
