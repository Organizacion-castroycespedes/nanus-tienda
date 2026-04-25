import { apiClient } from "../../lib/http";
import type { PermissionsResponse } from "./types";

export const fetchPermissions = () => apiClient<PermissionsResponse>("/me/permissions");
