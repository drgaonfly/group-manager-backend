import { IUser } from '../models/user';
import { IMenu } from '../models/menu';
import { IRole } from '../models/role';

const checkMenu = (menus: IMenu[], user: IUser): IMenu[] => {
  return menus.filter((menu) => {
    if (menu.children) {
      menu.children = checkMenu(menu.children, user);
    }

    if (user.isAdmin) {
      return true;
    }

    const roles = user.roles;

    if (!roles) {
      return false;
    }

    if (
      roles.some(
        (role: IRole) =>
          role.permissions &&
          role.permissions.some((permission) => {
            return (
              permission.path === menu.permission.path &&
              permission.action === menu.permission.action
            );
          }),
      )
    ) {
      return true;
    } else {
      return false;
    }
  });
};

export default checkMenu;
