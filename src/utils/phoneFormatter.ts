export const toE164 = (phone: string): string => {
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
};
