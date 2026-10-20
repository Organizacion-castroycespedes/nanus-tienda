export const createLatestRequestSequence = () => {
  let currentRequestId = 0;

  return {
    next: () => {
      currentRequestId += 1;
      return currentRequestId;
    },
    isCurrent: (requestId: number) => requestId === currentRequestId,
    invalidate: () => {
      currentRequestId += 1;
    },
  };
};
