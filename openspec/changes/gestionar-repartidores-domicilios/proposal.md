## Why

Delivery operations can create and manage deliveries, but drivers are still represented as raw user UUIDs or empty text in the UI. Staff need a small tenant-scoped driver catalog and a direct way to assign an active driver to a delivery without affecting cash, payments, POS, inventory, or fiscal behavior.

## What Changes

- Add a tenant-scoped `delivery_drivers` catalog with create, list, detail, edit, and logical deactivate behavior.
- Add `deliveries.driver_id` as an optional logistics reference to the driver catalog.
- Add backend endpoints for managing drivers and assigning or clearing a driver on a delivery.
- Show assigned driver information in delivery list and detail.
- Add delivery filtering by assigned driver.
- Add a basic frontend route for driver administration at `/{tenant}/deliveries/drivers`.
- Add a delivery screen entry point to manage drivers and assign or change drivers.
- Keep existing delivery state transitions unchanged when assigning drivers.
- Do not implement cash collection, cash settlement, payments, routes, geolocation, POS changes, inventory changes, or fiscal/electronic invoicing changes.

## Capabilities

### New Capabilities
- `delivery-drivers`: Tenant-scoped driver catalog management, delivery assignment, and delivery filtering by driver.

### Modified Capabilities

## Impact

- Additive SQL migration for `delivery_drivers` and `deliveries.driver_id`.
- New backend module/controller/service for `delivery-drivers`.
- Delivery API update for `POST /api/deliveries/:id/assign-driver` and `driver_id` filtering.
- Delivery DTO/response updates to include driver references and names.
- Frontend deliveries module updates for driver service, route, list/detail display, filter, and assignment UI.
- Optional menu/permission seed update only if needed for discoverability.
- No caja/recaudo, payments, POS, fiscal/electronic invoicing, inventory, or destructive SQL impact.
