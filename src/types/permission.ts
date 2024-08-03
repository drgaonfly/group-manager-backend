import {Request} from "express"
import {IPermission} from "../models/permission";

export interface RequestCustom extends Request
{
  permission?: IPermission;
}
