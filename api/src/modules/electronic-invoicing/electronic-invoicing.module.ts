import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { ElectronicInvoicingCustomersController } from "./customers/electronic-invoicing-customers.controller";
import { ElectronicInvoicingCustomersRepository } from "./customers/electronic-invoicing-customers.repository";
import { ElectronicInvoicingCustomersService } from "./customers/electronic-invoicing-customers.service";
import { DianDocumentTypesController } from "./document-types/dian-document-types.controller";
import { DianDocumentTypesRepository } from "./document-types/dian-document-types.repository";
import { DianDocumentTypesService } from "./document-types/dian-document-types.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [
    ElectronicInvoicingCustomersController,
    DianDocumentTypesController,
  ],
  providers: [
    ElectronicInvoicingCustomersRepository,
    ElectronicInvoicingCustomersService,
    DianDocumentTypesRepository,
    DianDocumentTypesService,
  ],
  exports: [
    ElectronicInvoicingCustomersService,
    DianDocumentTypesService,
  ],
})
export class ElectronicInvoicingModule {}
