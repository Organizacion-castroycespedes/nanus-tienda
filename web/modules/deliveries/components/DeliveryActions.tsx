import {
  Ban,
  CheckCircle2,
  Send,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import {
  getDeliveryActionLabel,
  getDeliveryAvailableActions,
} from "../delivery-helpers";
import type {
  DeliveryActionKey,
  DeliveryActionPermissionMap,
  DeliveryRecord,
} from "../types";

const actionIcons: Record<DeliveryActionKey, typeof UserCheck> = {
  prepare: UserCheck,
  dispatch: Send,
  "mark-delivered": CheckCircle2,
  "mark-not-delivered": Ban,
  cancel: XCircle,
};

export const DeliveryActions = ({
  delivery,
  permissions,
  disabled = false,
  onAction,
}: {
  delivery: DeliveryRecord;
  permissions: DeliveryActionPermissionMap;
  disabled?: boolean;
  onAction: (action: DeliveryActionKey, delivery: DeliveryRecord) => void;
}) => {
  const actions = getDeliveryAvailableActions(
    delivery.status,
    permissions,
    delivery
  );

  if (actions.length === 0) {
    return <span className="text-xs text-slate-400">Sin acciones</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = actionIcons[action] ?? Truck;
        const isDanger = action === "cancel" || action === "mark-not-delivered";
        return (
          <Button
            key={action}
            variant={isDanger ? "ghost" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={() => onAction(action, delivery)}
          >
            <Icon className="h-4 w-4" />
            {getDeliveryActionLabel(action, delivery)}
          </Button>
        );
      })}
    </div>
  );
};
