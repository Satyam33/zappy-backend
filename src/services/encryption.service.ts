import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

export const encrypt = (text: string, keyHex: string): { encrypted: string; iv: string; authTag: string } => {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex")
  };
};
