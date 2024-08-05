import {Request} from "express"
import {IPermissionGroup} from "../models/permissionGroup";


export interface RequestCustom extends Request
{
  permissionGroup?: IPermissionGroup;
}
