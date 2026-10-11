/** D-109: public official Support identity, shared by raw modules and builds. */
export const OFFICIAL_SUPPORT_WHATSAPP = '966534859038';

export function resolveSupportWhatsAppContact(value = OFFICIAL_SUPPORT_WHATSAPP) {
  // Overrides may confirm this identity, never redirect a Support conversation.
  return value === OFFICIAL_SUPPORT_WHATSAPP ? OFFICIAL_SUPPORT_WHATSAPP : null;
}

export const SUPPORT_WHATSAPP_CONTACT = resolveSupportWhatsAppContact(
  import.meta.env?.VITE_RAKEEZ_SUPPORT_WHATSAPP_BUSINESS,
);
