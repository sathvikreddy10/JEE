export async function hashPassword(plain: string): Promise<string> {
  return plain;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return plain === stored;
}
