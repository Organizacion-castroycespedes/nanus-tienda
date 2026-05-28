"use client";

import { useCallback, useState } from "react";
import type { NoticeDialogVariant } from "../components/design-system/NoticeDialog";
import {
  buildNoticeFromApiError,
  buildNoticeFromApiResponse,
  getNoticeTitleFromVariant,
  type ApiNoticeMessage,
} from "../lib/api-messages";

type NoticeState = ApiNoticeMessage & {
  open: boolean;
};

const initialNoticeState: NoticeState = {
  open: false,
  title: "",
  message: "",
  variant: "info",
};

export const useNoticeDialog = () => {
  const [notice, setNotice] = useState<NoticeState>(initialNoticeState);

  const show = useCallback((nextNotice: ApiNoticeMessage) => {
    setNotice({
      open: true,
      ...nextNotice,
    });
  }, []);

  const close = useCallback(() => {
    setNotice((current) => ({
      ...current,
      open: false,
    }));
  }, []);

  const showMessage = useCallback(
    (variant: NoticeDialogVariant, title: string, message: string) => {
      show({
        title,
        message,
        variant,
      });
    },
    [show]
  );

  const showSuccess = useCallback(
    (title: string, message: string) => showMessage("success", title, message),
    [showMessage]
  );

  const showError = useCallback(
    (title: string, message: string) => showMessage("error", title, message),
    [showMessage]
  );

  const showWarning = useCallback(
    (title: string, message: string) => showMessage("warning", title, message),
    [showMessage]
  );

  const showInfo = useCallback(
    (title: string, message: string) => showMessage("info", title, message),
    [showMessage]
  );

  const showFromApiResponse = useCallback(
    (response: unknown, fallbackMessage: string, fallbackTitle?: string) => {
      show(buildNoticeFromApiResponse(response, fallbackMessage, fallbackTitle));
    },
    [show]
  );

  const showFromApiError = useCallback(
    (error: unknown, fallbackMessage: string, fallbackTitle?: string) => {
      show(buildNoticeFromApiError(error, fallbackMessage, fallbackTitle));
    },
    [show]
  );

  const showByVariant = useCallback(
    (variant: NoticeDialogVariant, message: string, title?: string) => {
      show({
        title: title ?? getNoticeTitleFromVariant(variant),
        message,
        variant,
      });
    },
    [show]
  );

  return {
    ...notice,
    show,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showByVariant,
    showFromApiResponse,
    showFromApiError,
    close,
  };
};
