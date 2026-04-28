"use client";

import { PosScreen } from "../../../modules/pos/components/PosScreen";
import { useRequirePosSession } from "../../../domains/pos/hooks/useRequirePosSession";

const PosPage = () => {
  const { hasSession } = useRequirePosSession();

  if (!hasSession) {
    return null;
  }

  return <PosScreen />;
};

export default PosPage;
