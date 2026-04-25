import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(
    @Inject(LocationsService) private readonly locationsService: LocationsService
  ) {}

  @Get("paises")
  listCountries() {
    return this.locationsService.listCountries();
  }

  @Get("departamentos")
  listDepartments(@Query("paisId") paisId?: string) {
    return this.locationsService.listDepartments(paisId);
  }

  @Get("municipios")
  listMunicipalities(@Query("departamentoId") departamentoId?: string) {
    return this.locationsService.listMunicipalities(departamentoId);
  }
}
