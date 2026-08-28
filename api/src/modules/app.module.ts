import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { BranchesModule } from "./branches/branches.module";
import { LocationsModule } from "./locations/locations.module";
import { RolesModule } from "./roles/roles.module";
import { MenuModule } from "./menu/menu.module";
import { InventoryModule } from "./inventory/inventory.module";
import { TerminalsModule } from "./terminals/terminals.module";
import { PosUserSessionsModule } from "./pos-user-sessions/pos-user-sessions.module";
import { FinanceModule } from "./finance/finance.module";
import { SystemModule } from "./system/system.module";
import { ElectronicInvoicingModule } from "./electronic-invoicing/electronic-invoicing.module";
import { ElectronicBillingModule } from "./electronic-billing/electronic-billing.module";
import { IntegrationOutboxModule } from "./integration-outbox/integration-outbox.module";
import { PricingModule } from "./pricing/pricing.module";
import { PosTerminalsModule } from "./pos-terminals/pos-terminals.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TenantsModule,
    PermissionsModule,
    BranchesModule,
    LocationsModule,
    RolesModule,
    MenuModule,
    InventoryModule,
    TerminalsModule,
    PosUserSessionsModule,
    FinanceModule,
    SystemModule,
    ElectronicInvoicingModule,
    ElectronicBillingModule,
    IntegrationOutboxModule,
    PricingModule,
    PosTerminalsModule,
    DeliveriesModule,
  ],
})
export class AppModule {}
