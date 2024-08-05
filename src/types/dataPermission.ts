import {Request} from "express"
import {IDataPermission} from "../models/dataPermission";

export interface RequestCustom extends Request
{
  dataPermission?: IDataPermission;
}
