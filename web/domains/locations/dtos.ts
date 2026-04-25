export type CountryResponse = {
  id: string;
  codigo_iso2: string;
  codigo_iso3: string;
  nombre: string;
  moneda: string | null;
  simbolo_moneda: string | null;
};

export type DepartmentResponse = {
  id: string;
  pais_id: string;
  codigo_dane: string;
  nombre: string;
};

export type MunicipalityResponse = {
  id: string;
  departamento_id: string;
  codigo_dane: string;
  nombre: string;
  es_capital: boolean;
};
