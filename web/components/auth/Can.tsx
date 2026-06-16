"use client";

import type { ReactNode } from "react";
import { useAppSelector } from "../../store/hooks";
import { canPerformAction } from "../../lib/permissions";

type CanProps = {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export const useCan = (moduleCode: string, action: string) => {
  useAppSelector((state) => state.auth.permissions);
  useAppSelector((state) => state.auth.role);
  useAppSelector((state) => state.auth.user?.role);
  return canPerformAction(moduleCode, action);
};

export const Can = ({ module, action, children, fallback = null }: CanProps) =>
  useCan(module, action) ? <>{children}</> : <>{fallback}</>;
