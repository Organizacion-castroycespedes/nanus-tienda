import { SetMetadata } from "@nestjs/common";

export const REQUIRE_POS_SESSION_KEY = "requirePosSession";

export const RequirePosSession = () =>
  SetMetadata(REQUIRE_POS_SESSION_KEY, true);
