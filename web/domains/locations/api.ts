import { apiClient } from "../../lib/http";
import type {
  CountryResponse,
  DepartmentResponse,
  MunicipalityResponse,
} from "./dtos";

export const listCountries = () =>
  apiClient<CountryResponse[]>("/locations/paises");

export const listDepartments = (paisId: string) =>
  apiClient<DepartmentResponse[]>(
    `/locations/departamentos?paisId=${encodeURIComponent(paisId)}`
  );

export const listMunicipalities = (departamentoId: string) =>
  apiClient<MunicipalityResponse[]>(
    `/locations/municipios?departamentoId=${encodeURIComponent(departamentoId)}`
  );
