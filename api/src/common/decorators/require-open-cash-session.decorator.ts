import { SetMetadata } from "@nestjs/common";

export const REQUIRE_OPEN_CASH_SESSION_KEY = "requireOpenCashSession";

export const RequireOpenCashSession = () =>
  SetMetadata(REQUIRE_OPEN_CASH_SESSION_KEY, true);
