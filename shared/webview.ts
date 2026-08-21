export function shouldOpenWhatsAppInCurrentView(userAgent: string, hasCapacitorBridge = false) {
  return hasCapacitorBridge || /;\s*wv\)|\bCapacitor\b/i.test(userAgent);
}
