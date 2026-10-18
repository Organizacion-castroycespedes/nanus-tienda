export type ConfirmedSalePostProcessingTasks = {
  openCashDrawer?: () => void | Promise<unknown>;
  triggerPrintWorkflow?: () => void | Promise<unknown>;
  refreshProducts?: () => void | Promise<unknown>;
  onBackgroundError?: (error: unknown) => void;
};

const startBackgroundTask = (
  task: (() => void | Promise<unknown>) | undefined,
  onError: (error: unknown) => void
) => {
  if (!task) return;
  try {
    void Promise.resolve(task()).catch(onError);
  } catch (error) {
    onError(error);
  }
};

/** Run side effects after createSale already returned successfully. */
export const runConfirmedSalePostProcessing = async ({
  openCashDrawer,
  triggerPrintWorkflow,
  refreshProducts,
  onBackgroundError,
}: ConfirmedSalePostProcessingTasks) => {
  const reportError = onBackgroundError ?? (() => undefined);
  startBackgroundTask(openCashDrawer, reportError);
  startBackgroundTask(triggerPrintWorkflow, reportError);
  if (refreshProducts) {
    try {
      await refreshProducts();
    } catch (error) {
      reportError(error);
    }
  }
};
