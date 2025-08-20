const DEV_TOKENS = new Set<string>(['dev-device']);

export function verifyDeviceToken(token: string | undefined): boolean {
  return !!token && DEV_TOKENS.has(token);
}
