import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { DatabaseModule } from "../../common/db/database.module";
import { FinanceModule } from "../finance/finance.module";
import { FinanceAccessRepository } from "../finance/common/repositories/finance-access.repository";
import { PricingModule } from "../pricing/pricing.module";
import { CustomerController } from "./controllers/customer.controller";
import { InventoryFefoController } from "./controllers/inventory-fefo.controller";
import { InventoryController } from "./controllers/inventory.controller";
import { InventoryLotReconciliationController } from "./controllers/inventory-lot-reconciliation.controller";
import { InventoryLotBalanceController } from "./controllers/inventory-lot-balance.controller";
import { InventoryLotController } from "./controllers/inventory-lot.controller";
import { InventoryLocationController } from "./controllers/inventory-location.controller";
import { OrderController } from "./controllers/order.controller";
import { ProductBarcodeController } from "./controllers/product-barcode.controller";
import { ProductCategoryController } from "./controllers/product-category.controller";
import { ProductController } from "./controllers/product.controller";
import { ProductSubcategoryController } from "./controllers/product-subcategory.controller";
import { PurchaseController } from "./controllers/purchase.controller";
import { SaleController } from "./controllers/sale.controller";
import { SupplierController } from "./controllers/supplier.controller";
import { StockAdjustmentController } from "./controllers/stock-adjustment.controller";
import { StockMovementLotController } from "./controllers/stock-movement-lot.controller";
import { TaxController } from "./controllers/tax.controller";
import { UnitController } from "./controllers/unit.controller";
import { CustomerService } from "./services/customer.service";
import { InventoryFefoService } from "./services/inventory-fefo.service";
import { InventoryService } from "./services/inventory.service";
import { InventoryLotBalanceService } from "./services/inventory-lot-balance.service";
import { InventoryLotService } from "./services/inventory-lot.service";
import { InventoryLocationService } from "./services/inventory-location.service";
import { InventoryLotReconciliationService } from "./services/inventory-lot-reconciliation.service";
import { OrderService } from "./services/order.service";
import { ProductBarcodeService } from "./services/product-barcode.service";
import { ProductCategoryService } from "./services/product-category.service";
import { LocalImageStorageService } from "./services/local-image-storage.service";
import { ProductService } from "./services/product.service";
import { ProductImageService } from "./services/product-image.service";
import { ProductSubcategoryService } from "./services/product-subcategory.service";
import { PurchaseService } from "./services/purchase.service";
import { SaleService } from "./services/sale.service";
import { StockAdjustmentService } from "./services/stock-adjustment.service";
import { StockMovementService } from "./services/stock-movement.service";
import { StockMovementLotService } from "./services/stock-movement-lot.service";
import { SupplierService } from "./services/supplier.service";
import { TaxService } from "./services/tax.service";
import { UnitService } from "./services/unit.service";
import { CustomerRepository } from "./repositories/customer.repository";
import { InventoryFefoRepository } from "./repositories/inventory-fefo.repository";
import { InventoryRepository } from "./repositories/inventory.repository";
import { InventoryLotBalanceRepository } from "./repositories/inventory-lot-balance.repository";
import { InventoryLotRepository } from "./repositories/inventory-lot.repository";
import { InventoryLocationRepository } from "./repositories/inventory-location.repository";
import { InventoryLotReconciliationRepository } from "./repositories/inventory-lot-reconciliation.repository";
import { ProductBarcodeRepository } from "./repositories/product-barcode.repository";
import { ProductCategoryRepository } from "./repositories/product-category.repository";
import { ProductRepository } from "./repositories/product.repository";
import { ProductSubcategoryRepository } from "./repositories/product-subcategory.repository";
import { SaleRepository } from "./repositories/sale.repository";
import { StockMovementLotRepository } from "./repositories/stock-movement-lot.repository";
import { SupplierRepository } from "./repositories/supplier.repository";
import { TaxRepository } from "./repositories/tax.repository";
import { UnitRepository } from "./repositories/unit.repository";

@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    CommonServicesModule,
    FinanceModule,
    PricingModule,
  ],
  controllers: [
    InventoryFefoController,
    InventoryController,
    InventoryLotReconciliationController,
    InventoryLotBalanceController,
    InventoryLotController,
    InventoryLocationController,
    ProductController,
    ProductBarcodeController,
    ProductCategoryController,
    ProductSubcategoryController,
    SupplierController,
    UnitController,
    TaxController,
    StockAdjustmentController,
    PurchaseController,
    CustomerController,
    OrderController,
    SaleController,
    StockMovementLotController,
  ],
  providers: [
    CustomerService,
    InventoryFefoService,
    InventoryService,
    InventoryLotBalanceService,
    InventoryLotService,
    InventoryLocationService,
    InventoryLotReconciliationService,
    OrderService,
    ProductService,
    ProductImageService,
    LocalImageStorageService,
    ProductBarcodeService,
    ProductCategoryService,
    ProductSubcategoryService,
    PurchaseService,
    SaleService,
    StockAdjustmentService,
    StockMovementService,
    StockMovementLotService,
    SupplierService,
    UnitService,
    TaxService,
    CustomerRepository,
    InventoryFefoRepository,
    InventoryRepository,
    InventoryLotBalanceRepository,
    InventoryLotRepository,
    InventoryLocationRepository,
    InventoryLotReconciliationRepository,
    ProductRepository,
    ProductBarcodeRepository,
    ProductCategoryRepository,
    ProductSubcategoryRepository,
    SaleRepository,
    StockMovementLotRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
    FinanceAccessRepository,
  ],
  exports: [
    CustomerService,
    InventoryFefoService,
    InventoryService,
    InventoryLotBalanceService,
    InventoryLotService,
    InventoryLocationService,
    InventoryLotReconciliationService,
    OrderService,
    ProductService,
    ProductBarcodeService,
    ProductCategoryService,
    ProductSubcategoryService,
    PurchaseService,
    SaleService,
    StockAdjustmentService,
    StockMovementService,
    StockMovementLotService,
    SupplierService,
    UnitService,
    TaxService,
    CustomerRepository,
    InventoryFefoRepository,
    InventoryRepository,
    InventoryLotBalanceRepository,
    InventoryLotRepository,
    InventoryLocationRepository,
    InventoryLotReconciliationRepository,
    ProductRepository,
    ProductBarcodeRepository,
    ProductCategoryRepository,
    ProductSubcategoryRepository,
    SaleRepository,
    StockMovementLotRepository,
    SupplierRepository,
    UnitRepository,
    TaxRepository,
  ],
})
export class InventoryModule {}
