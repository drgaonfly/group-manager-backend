// middlewares/authMiddleware.ts
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';
import { IPermission } from '../models/permission';
import handleAsync from '../utils/handleAsync';
import { ROLES } from '../constants';
import { RequestCustom } from '/user';
import { IDataPermission } from '../models/dataPermission';
import { IRole } from '../models/role';

const protect = handleAsync(
  async (
    req: RequestCustom,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      try {
        token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string,
        ) as jwt.JwtPayload;

        const user: IUser | null = await User.findById(decoded.id)
          .populate('proxy')
          .populate({
            path: 'roles',
            populate: [
              {
                path: 'permissions',
                model: 'Permission',
              },
              {
                path: 'dataPermissions',
                model: 'DataPermission',
              },
            ],
          })
          .exec();

        if (!user || !user.live) {
          throw new Error('User is not live or not found');
        }

        req.user = user;
        next();
      } catch (error) {
        console.error(error);
        res
          .status(401)
          .send({ message: error.message || 'Not authorized, token failed' });
      }
    }

    if (!token) {
      res.status(401).send({ message: 'Not authorized, no token' });
    }
  },
);

const allow = (
  roles: string | string[],
): ((req: RequestCustom, res: Response, next: NextFunction) => void) => {
  return (req: RequestCustom, res: Response, next: NextFunction): void => {
    // 将单个角色字符串转换为数组形式，以统一处理逻辑
    const rolesArray = Array.isArray(roles) ? roles : [roles];

    // 检查req.user.roles数组中是否包含rolesArray中的任何一个角色，或者是否是SuperAdmin
    // 或者检查req.query.pageSize是否等于10000
    if (
      req.query.pageSize === '10000' ||
      (req.user &&
        (rolesArray.some((role) => req.user.roles.includes(role)) ||
          req.user.roles.includes(ROLES.SuperAdmin)))
    ) {
      next();
    } else {
      res
        .status(401)
        .send({ message: `Not authorized as any of the required roles` });
    }
  };
};

const checkPermission = handleAsync(
  async (
    req: RequestCustom,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { pageSize } = req.query as { pageSize?: string };

    if (pageSize && pageSize === '10000') {
      return next();
    }

    let path = req.baseUrl + req.route.path;
    if (path.startsWith('/api')) {
      path = path.slice(4);
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const action = req.method;

    console.log('Checking path for permission', path);

    if (req.user.isAdmin) {
      return next();
    }

    const roles = req.user.roles as { permissions: IPermission[] }[];

    if (roles.length === 0) {
      res.status(403);
      throw new Error('Access Denied');
    }

    const isAllowed = (permissions: IPermission[]): boolean => {
      return permissions.some((permission) => {
        return permission.path === path && permission.action === action;
      });
    };

    if (roles.some((role) => isAllowed(role.permissions))) {
      next();
    } else {
      res.status(403);
      throw new Error('Access Denied');
    }
  },
);

const checkDataPermission = handleAsync(
  async (
    req: RequestCustom,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    let path = req.baseUrl + req.route.path;
    if (path.startsWith('/api')) {
      path = path.slice(4);
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    console.log('Checking path for data permission', path);

    if (req.user.isAdmin) {
      req.getAllData = true;
      return next();
    }

    const roles = req.user.roles as IRole[]; // Ensure roles are typed correctly

    if (roles.length === 0) {
      return next();
    }

    const isAllowed = (dataPermissions: IDataPermission[]): boolean => {
      return !!dataPermissions.find(
        (dataPermission) => dataPermission.path === path,
      );
    };

    if (roles.some((role) => isAllowed(role.dataPermissions))) {
      req.getAllData = true;
      next();
    } else {
      next();
    }
  },
);

export const isProxy = (user: IUser): boolean => {
  return (
    user.roles && user.roles.length === 1 && user.roles[0]?.name === '代理'
  );
};

export const isEmployee = (user: IUser): boolean => {
  return (
    user.roles && user.roles.length === 1 && user.roles[0]?.name === '员工'
  );
};

export { protect, allow, checkPermission, checkDataPermission };
