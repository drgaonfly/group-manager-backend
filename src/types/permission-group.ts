import {Request} from "express"
import {IPermissionGroup} from "../models/permission-group";


export interface RequestCustom extends Request
{
  permissionGroup?: IPermissionGroup;
}
