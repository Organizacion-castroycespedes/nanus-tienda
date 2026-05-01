import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FinanceActor, FinanceAuthRequest } from "../finance.types";

@Injectable()
export class FinanceAuthzGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FinanceAuthRequest>();
    const userId = request.user?.id?.trim();
    const tenantId = request.user?.tenantId?.trim();

    if (!userId || !tenantId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const actor: FinanceActor = {
      userId,
      tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      sessionId: request.user?.sessionId?.trim() || undefined,
    };

    request.financeActor = actor;
    return true;
  }
}
