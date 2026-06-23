import { DeliveriesScreen } from "../../../modules/deliveries/components/DeliveriesScreen";
import type { DeliverySearchParamsInput } from "../../../modules/deliveries/delivery-navigation";

type DeliveriesPageProps = {
  searchParams?: DeliverySearchParamsInput;
};

const DeliveriesPage = ({ searchParams = {} }: DeliveriesPageProps) => (
  <DeliveriesScreen initialSearchParams={searchParams} />
);

export default DeliveriesPage;
