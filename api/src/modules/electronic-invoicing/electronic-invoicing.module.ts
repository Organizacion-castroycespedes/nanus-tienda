import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { ElectronicInvoicingCustomersController } from "./customers/electronic-invoicing-customers.controller";
import { ElectronicInvoicingCustomersRepository } from "./customers/electronic-invoicing-customers.repository";
import { ElectronicInvoicingCustomersService } from "./customers/electronic-invoicing-customers.service";
import { DianDocumentTypesController } from "./document-types/dian-document-types.controller";
import { DianDocumentTypesRepository } from "./document-types/dian-document-types.repository";
import { DianDocumentTypesService } from "./document-types/dian-document-types.service";
import { ElectronicInvoicingSuppliersController } from "./suppliers/electronic-invoicing-suppliers.controller";
import { ElectronicInvoicingSuppliersRepository } from "./suppliers/electronic-invoicing-suppliers.repository";
import { ElectronicInvoicingSuppliersService } from "./suppliers/electronic-invoicing-suppliers.service";
import { ThirdPartyLookupMockAdapter } from "./third-party-lookup/third-party-lookup.mock-adapter";
import { ThirdPartyLookupService } from "./third-party-lookup/third-party-lookup.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [
    ElectronicInvoicingCustomersController,
    ElectronicInvoicingSuppliersController,
    DianDocumentTypesController,
  ],
  providers: [
    ElectronicInvoicingCustomersRepository,
    ElectronicInvoicingCustomersService,
    ElectronicInvoicingSuppliersRepository,
    ElectronicInvoicingSuppliersService,
    ThirdPartyLookupMockAdapter,
    ThirdPartyLookupService,
    DianDocumentTypesRepository,
    DianDocumentTypesService,
  ],
  exports: [
    ElectronicInvoicingCustomersService,
    ElectronicInvoicingSuppliersService,
    ThirdPartyLookupService,
    DianDocumentTypesService,
  ],
})
export class ElectronicInvoicingModule {}
