import { apiClient } from "../../lib/http";

export type SystemVersionResponse = {
  version: string;
};

export const fetchSystemVersion = () =>
  apiClient<SystemVersionResponse>("/system/version");
