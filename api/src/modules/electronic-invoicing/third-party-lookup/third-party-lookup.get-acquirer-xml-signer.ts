import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { GET_ACQUIRER_SOAP_NAMESPACES } from "./third-party-lookup.get-acquirer-request.builder";

export const GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS = {
  canonicalization: "http://www.w3.org/2001/10/xml-exc-c14n#",
  digest: "http://www.w3.org/2001/04/xmlenc#sha256",
  signature: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  transform: "http://www.w3.org/2001/10/xml-exc-c14n#",
} as const;

export type GetAcquirerXmlSignatureMaterial = {
  privateKeyPem: string;
  publicCertPem: string;
};

export type SignedGetAcquirerSoapRequest = {
  binarySecurityTokenId: string;
  signedXml: string;
  signatureXml: string;
  signedReferenceUris: string[];
};

const BINARY_SECURITY_TOKEN_ID = "BinarySecurityToken-1";
const BODY_XPATH =
  "//*[local-name(.)='Body' and namespace-uri(.)='http://www.w3.org/2003/05/soap-envelope']";
const BST_ENCODING_TYPE =
  "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary";
const BST_VALUE_TYPE =
  "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3";
const SECURITY_XPATH =
  "//*[local-name(.)='Security' and namespace-uri(.)='http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd']";
const SIGNATURE_XPATH =
  "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']";
const TIMESTAMP_XPATH =
  "//*[local-name(.)='Timestamp' and namespace-uri(.)='http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd']";

export const stripPemCertificate = (publicCertPem: string): string =>
  publicCertPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

const buildSecurityTokenReference = (tokenId: string): string =>
  `<wsse:SecurityTokenReference xmlns:wsse="${GET_ACQUIRER_SOAP_NAMESPACES.wsse}">
        <wsse:Reference URI="#${tokenId}" ValueType="${BST_VALUE_TYPE}" />
      </wsse:SecurityTokenReference>`;

const buildBinarySecurityToken = (
  material: GetAcquirerXmlSignatureMaterial,
  tokenId: string
): string =>
  `<wsse:BinarySecurityToken wsu:Id="${tokenId}" EncodingType="${BST_ENCODING_TYPE}" ValueType="${BST_VALUE_TYPE}">${stripPemCertificate(
    material.publicCertPem
  )}</wsse:BinarySecurityToken>`;

const withBinarySecurityToken = (
  soapXml: string,
  material: GetAcquirerXmlSignatureMaterial,
  tokenId: string
): string => {
  if (soapXml.includes(`wsu:Id="${tokenId}"`)) {
    return soapXml;
  }

  return soapXml.replace(
    "    </wsse:Security>",
    `      ${buildBinarySecurityToken(material, tokenId)}
    </wsse:Security>`
  );
};

const buildSigner = (
  material: GetAcquirerXmlSignatureMaterial,
  tokenId: string
) =>
  new SignedXml({
    canonicalizationAlgorithm:
      GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.canonicalization,
    getKeyInfoContent: () => buildSecurityTokenReference(tokenId),
    idMode: "wssecurity",
    privateKey: material.privateKeyPem,
    publicCert: material.publicCertPem,
    signatureAlgorithm: GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.signature,
  });

export const signGetAcquirerSoapRequest = (
  soapXml: string,
  material: GetAcquirerXmlSignatureMaterial
): SignedGetAcquirerSoapRequest => {
  const binarySecurityTokenId = BINARY_SECURITY_TOKEN_ID;
  const soapXmlWithToken = withBinarySecurityToken(
    soapXml,
    material,
    binarySecurityTokenId
  );
  const signer = buildSigner(material, binarySecurityTokenId);
  signer.addReference({
    digestAlgorithm: GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.digest,
    transforms: [GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.transform],
    uri: "#Body-1",
    xpath: BODY_XPATH,
  });
  signer.addReference({
    digestAlgorithm: GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.digest,
    transforms: [GET_ACQUIRER_XML_SIGNATURE_ALGORITHMS.transform],
    uri: "#Timestamp-1",
    xpath: TIMESTAMP_XPATH,
  });

  signer.computeSignature(soapXmlWithToken, {
    existingPrefixes: {
      dian: GET_ACQUIRER_SOAP_NAMESPACES.dian,
      soap: GET_ACQUIRER_SOAP_NAMESPACES.soap,
      wsa: GET_ACQUIRER_SOAP_NAMESPACES.wsa,
      wsse: GET_ACQUIRER_SOAP_NAMESPACES.wsse,
      wsu: GET_ACQUIRER_SOAP_NAMESPACES.wsu,
    },
    location: {
      action: "append",
      reference: SECURITY_XPATH,
    },
    prefix: "ds",
  });

  return {
    binarySecurityTokenId,
    signedXml: signer.getSignedXml(),
    signatureXml: signer.getSignatureXml(),
    signedReferenceUris: ["#Body-1", "#Timestamp-1"],
  };
};

export const verifyGetAcquirerSoapSignature = (
  signedXml: string,
  publicCertPem: string
): boolean => {
  const document = new DOMParser().parseFromString(signedXml, "text/xml");
  const signatureNode = document.getElementsByTagName("ds:Signature")[0];
  if (!signatureNode) {
    return false;
  }

  const verifier = new SignedXml({
    idMode: "wssecurity",
    publicCert: publicCertPem,
  });
  verifier.loadSignature(new XMLSerializer().serializeToString(signatureNode));

  return verifier.checkSignature(signedXml);
};

export const GET_ACQUIRER_SIGNATURE_XPATHS = {
  body: BODY_XPATH,
  binarySecurityTokenId: BINARY_SECURITY_TOKEN_ID,
  security: SECURITY_XPATH,
  signature: SIGNATURE_XPATH,
  timestamp: TIMESTAMP_XPATH,
} as const;
