import type { PreserveUnknownFields } from "./common";

export interface QuickReplyItem extends PreserveUnknownFields {
  label: string;
  message: string;
  isAuto?: boolean;
  trigger?: string;
}

export interface QuickReplySet extends PreserveUnknownFields {
  version?: string | number;
  name: string;
  qrList: QuickReplyItem[];
}
