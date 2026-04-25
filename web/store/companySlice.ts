import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type CompanyDetails = {
  razonSocial: string;
  nit: string;
  dv?: string;
  tipoPersona: string;
  tipoSociedad?: string;
  fechaConstitucion?: string;
  estado: string;
  responsabilidadesDian?: string;
  regimen?: string;
  actividadEconomica?: string;
  obligadoFacturacionElectronica?: boolean;
  resolucionDian?: string;
  fechaInicioFacturacion?: string;
  direccionPrincipal?: string;
  paisId?: string;
  departamentoId?: string;
  municipioId?: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  telefono?: string;
  emailCorporativo?: string;
  sitioWeb?: string;
  representanteNombre?: string;
  representanteTipoDocumento?: string;
  representanteNumeroDocumento?: string;
  representanteEmail?: string;
  representanteTelefono?: string;
  cuentaContableDefecto?: string;
  bancoPrincipal?: string;
  numeroCuenta?: string;
  tipoCuenta?: string;
};

export type CompanyState = {
  details: CompanyDetails | null;
};

const initialState: CompanyState = {
  details: null,
};

const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {
    setCompanyDetails(state, action: PayloadAction<CompanyDetails | null>) {
      state.details = action.payload;
    },
    updateCompanyDetails(state, action: PayloadAction<Partial<CompanyDetails>>) {
      state.details = {
        ...state.details,
        ...action.payload,
      } as CompanyDetails;
    },
    resetCompanyDetails(state) {
      state.details = null;
    },
  },
});

export const { setCompanyDetails, updateCompanyDetails, resetCompanyDetails } =
  companySlice.actions;
export default companySlice.reducer;
