import { DeliveriesScreen } from "../../../modules/deliveries/components/DeliveriesScreen";
import type { DeliverySearchParamsInput } from "../../../modules/deliveries/delivery-navigation";

type DeliveriesPageProps = {
  searchParams?: Promise<DeliverySearchParamsInput>;
};

const DeliveriesPage = async ({ searchParams }: DeliveriesPageProps) => {
  const initialSearchParams = (await searchParams) ?? {};

  return <DeliveriesScreen initialSearchParams={initialSearchParams} />;
};

export default DeliveriesPage;
