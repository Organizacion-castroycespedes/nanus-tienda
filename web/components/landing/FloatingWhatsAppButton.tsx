import { MessageCircle } from "lucide-react";
import { getCommercialWhatsAppUrl } from "../../lib/contact-info";

const FloatingWhatsAppButton = () => (
  <a
    aria-label="Hablar con Manus POS por WhatsApp"
    className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-xl shadow-green-950/25 transition hover:-translate-y-0.5 hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    href={getCommercialWhatsAppUrl()}
    rel="noopener noreferrer"
    target="_blank"
    title="Hablar por WhatsApp"
  >
    <MessageCircle className="h-7 w-7" aria-hidden="true" />
  </a>
);

export default FloatingWhatsAppButton;
