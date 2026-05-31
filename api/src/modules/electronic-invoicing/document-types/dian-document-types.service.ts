import { Inject, Injectable } from "@nestjs/common";
import { DianDocumentTypesRepository } from "./dian-document-types.repository";

@Injectable()
export class DianDocumentTypesService {
  constructor(
    @Inject(DianDocumentTypesRepository)
    private readonly documentTypesRepository: DianDocumentTypesRepository
  ) {}

  listActive() {
    return this.documentTypesRepository.findActive("CO");
  }
}
