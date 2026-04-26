import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { InventoryController } from "./controllers/inventory.controller";
import { ProductController } from "./controllers/product.controller";
import { SupplierController } from "./controllers/supplier.controller";
import { StockAdjustmentController } from "./controllers/stock-adjustment.controller";
import { TaxController } from "./controllers/tax.controller";
import { UnitController } from "./controllers/unit.controller";
import { InventoryService } from "./services/inventory.service";
import { ProductService } from "./services/product.service";
import { PurchaseService } from "./services/purchase.service";
import { StockMovementService } from "./services/stock-movement.service";
import { SupplierService } from "./services/supplier.service";
import { TaxService } from "./services/tax.service";
import { UnitService } from "./services/unit.service";
import { InventoryRepository } from "./repositories/inventory.repository";
import { ProductRepository } from "./repositories/product.repository";
import { SupplierRepository } from "./repositories/supplier.repository";
import { TaxRepository } from "./repositories/tax.repository";
import { UnitRepository } from "./repositories/unit.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [
    InventoryController,
    ProductController,
    SupplierController,
    UnitController,
    TaxController,
    StockAdjustmentController,
  ],
  providers: [
    InventoryService,
    ProductService,
    PurchaseService,
    StockMovementService,
    SupplierService,
    UnitService,
    TaxService,
    InventoryRepository,
    ProductRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
  ],
  exports: [
    InventoryService,
    ProductService,
    PurchaseService,
    StockMovementService,
    SupplierService,
    UnitService,
    TaxService,
    InventoryRepository,
    ProductRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
  ],
})
export class InventoryModule {}
