import assert from "node:assert/strict";
import test from "node:test";
import { extractFiscalIssuerSnapshot } from "./electronic-billing-processing.service";

test("extracts the fiscal issuer from the signed supplier party", () => {
  const xml = `
    <Invoice>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PhysicalLocation><cac:Address>
            <cbc:CityName>Barranquilla</cbc:CityName>
            <cbc:CountrySubentity>Atlántico</cbc:CountrySubentity>
            <cac:AddressLine><cbc:Line>CL 18B 17F 24</cbc:Line></cac:AddressLine>
            <cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country>
          </cac:Address></cac:PhysicalLocation>
          <cac:PartyTaxScheme>
            <cbc:RegistrationName>SIRLEY MAYERLIS CESPEDES ANAYA</cbc:RegistrationName>
            <cbc:CompanyID schemeID="5">1045697508</cbc:CompanyID>
          </cac:PartyTaxScheme>
          <cac:Contact><cbc:Telephone>3022243805</cbc:Telephone><cbc:ElectronicMail>07luzca@gmail.com</cbc:ElectronicMail></cac:Contact>
        </cac:Party>
      </cac:AccountingSupplierParty>
    </Invoice>`;

  assert.deepEqual(extractFiscalIssuerSnapshot(xml), {
    name: "SIRLEY MAYERLIS CESPEDES ANAYA",
    identificationType: "NIT",
    identificationNumber: "1045697508",
    verificationDigit: "5",
    address: "CL 18B 17F 24",
    country: "CO",
    department: "Atlántico",
    municipality: "Barranquilla",
    phone: "3022243805",
    email: "07luzca@gmail.com",
  });
});

test("does not invent a fiscal issuer when the supplier party is absent", () => {
  assert.equal(extractFiscalIssuerSnapshot("<Invoice />"), null);
});
