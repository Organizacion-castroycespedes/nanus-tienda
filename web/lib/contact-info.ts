export const CONTACT_INFO = {
  brandName: "Manus POS",
  developerName: "Castro y Céspedes Development",
  email: "castroycespedes@gmail.com",
  phone: "3004107145",
  countryCode: "57",
  demoSubject: "Solicitud de demo - Manus POS",
  demoBody: "Hola, estoy interesado en solicitar una demostración de Manus POS.",
  whatsappMessage:
    "Hola, estoy interesado en conocer Manus POS y quisiera recibir más información.",
};

export const normalizePhoneForWhatsApp = (phone: string) =>
  phone.replace(/\D/g, "");

export const getCommercialWhatsAppNumber = () =>
  `${CONTACT_INFO.countryCode}${normalizePhoneForWhatsApp(CONTACT_INFO.phone)}`;

export const getCommercialWhatsAppUrl = (message = CONTACT_INFO.whatsappMessage) =>
  `https://wa.me/${getCommercialWhatsAppNumber()}?text=${encodeURIComponent(message)}`;

export const getCommercialMailtoUrl = (
  subject = CONTACT_INFO.demoSubject,
  body = CONTACT_INFO.demoBody
) =>
  `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
