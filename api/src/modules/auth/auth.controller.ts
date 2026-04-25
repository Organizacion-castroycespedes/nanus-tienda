import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Response } from 'express';
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { LoginDto } from "./dto/login.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import { MenuService } from "../menu/menu.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UsersService } from "../users/users.service";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { UpdateUserPasswordDto } from "../users/dto/update-password.dto";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(MenuService) private readonly menuService: MenuService,
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  private buildActor(request: Request & { user?: { roles?: string[]; tenantId?: string; id?: string } }) {
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
    };
  }

  @Post("login")
  login(@Body() payload: LoginDto, @Req() request: Request) {
    return this.authService.login(payload, this.buildRefreshMetadata(request));
  }

  @Post("login/force")
  loginForce(@Body() payload: LoginDto, @Req() request: Request) {
    return this.authService.forceLogin(payload, this.buildRefreshMetadata(request));
  }

  @Post("forgot-password")
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Post("reset-password")
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Post('logout')
  async logout(
    @Body() payload: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    });

    await this.authService.logout(payload?.refreshToken);
    return { ok: true };
  }

  @Post("refresh")
  refresh(@Body() payload: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshToken(payload, this.buildRefreshMetadata(request));
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException("Token requerido");
    }
    return this.authService.getProfileForAccessToken(token);
  }

  @Get("menu")
  async menu(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException("Token requerido");
    }
    return this.menuService.getMenuForAccessToken(token);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateProfile(@Body() payload: UpdateProfileDto, @Req() request: Request) {
    const actor = this.buildActor(request);
    if (!actor.userId) {
      throw new UnauthorizedException("Usuario requerido");
    }
    return this.usersService.updateSelfProfile(payload, actor);
  }

  @Patch("me/password")
  @UseGuards(JwtAuthGuard)
  updatePassword(@Body() payload: UpdateUserPasswordDto, @Req() request: Request) {
    const actor = this.buildActor(request);
    if (!actor.userId) {
      throw new UnauthorizedException("Usuario requerido");
    }
    return this.usersService.updateSelfPassword(payload, actor);
  }

  private buildRefreshMetadata(request: Request) {
    const userAgentHeader = request.headers["user-agent"];
    const forwardedFor = request.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === "string"
        ? forwardedFor
        : undefined;
    const ipAddress =
      forwardedIp?.split(",")[0]?.trim() ??
      request.ip ??
      (request.connection as { remoteAddress?: string })?.remoteAddress;
    return {
      userAgent: typeof userAgentHeader === "string" ? userAgentHeader : undefined,
      ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
    };
  }
}
