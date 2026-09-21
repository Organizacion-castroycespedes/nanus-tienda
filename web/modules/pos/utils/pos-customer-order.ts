import type { CustomerResponse } from "../../inventory/services/customer.service";

export const sortPosCustomers = (customers: CustomerResponse[]) => {
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  return customers
    .map((customer, index) => ({ customer, index }))
    .sort((left, right) => {
      const byName = collator.compare(left.customer.name, right.customer.name);
      return byName || left.index - right.index;
    })
    .map(({ customer }) => customer);
};
