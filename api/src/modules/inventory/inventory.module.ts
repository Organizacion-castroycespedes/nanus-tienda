import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { DatabaseModule } from "../../common/db/database.module";
import { FinanceModule } from "../finance/finance.module";
import { FinanceAccessRepository } from "../finance/common/repositories/finance-access.repository";
import { CustomerController } from "./controllers/customer.controller";
import { InventoryController } from "./controllers/inventory.controller";
import { OrderController } from "./controllers/order.controller";
import { ProductController } from "./controllers/product.controller";
import { PurchaseController } from "./controllers/purchase.controller";
import { SaleController } from "./controllers/sale.controller";
import { SupplierController } from "./controllers/supplier.controller";
import { StockAdjustmentController } from "./controllers/stock-adjustment.controller";
import { TaxController } from "./controllers/tax.controller";
import { UnitController } from "./controllers/unit.controller";
import { CustomerService } from "./services/customer.service";
import { InventoryService } from "./services/inventory.service";
import { OrderService } from "./services/order.service";
import { ProductService } from "./services/product.service";
import { PurchaseService } from "./services/purchase.service";
import { SaleService } from "./services/sale.service";
import { StockMovementService } from "./services/stock-movement.service";
import { SupplierService } from "./services/supplier.service";
import { TaxService } from "./services/tax.service";
import { UnitService } from "./services/unit.service";
import { CustomerRepository } from "./repositories/customer.repository";
import { InventoryRepository } from "./repositories/inventory.repository";
import { ProductRepository } from "./repositories/product.repository";
import { SaleRepository } from "./repositories/sale.repository";
import { SupplierRepository } from "./repositories/supplier.repository";
import { TaxRepository } from "./repositories/tax.repository";
import { UnitRepository } from "./repositories/unit.repository";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule, FinanceModule],
  controllers: [
    InventoryController,
    ProductController,
    SupplierController,
    UnitController,
    TaxController,
    StockAdjustmentController,
    PurchaseController,
    CustomerController,
    OrderController,
    SaleController,
  ],
  providers: [
    CustomerService,
    InventoryService,
    OrderService,
    ProductService,
    PurchaseService,
    SaleService,
    StockMovementService,
    SupplierService,
    UnitService,
    TaxService,
    CustomerRepository,
    InventoryRepository,
    ProductRepository,
    SaleRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
    FinanceAccessRepository,
  ],
  exports: [
    CustomerService,
    InventoryService,
    OrderService,
    ProductService,
    PurchaseService,
    SaleService,
    StockMovementService,
    SupplierService,
    UnitService,
    TaxService,
    CustomerRepository,
    InventoryRepository,
    ProductRepository,
    SaleRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
  ],
})
export class InventoryModule {}
