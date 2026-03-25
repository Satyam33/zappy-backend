import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../../config/database";
import { env } from "../../config/env";

const SignupSchema = z.object({
  email: z.string().email(),
  mobile: z.string().min(8).max(20),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  organizationName: z.string().min(2),
  otpId: z.string().uuid()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10)
});

const ForgotPasswordSchema = z.object({
  email: z.string().email()
});

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8)
});

const SignupOtpRequestSchema = z.object({
  email: z.string().email(),
  mobile: z.string().min(8).max(20)
});

const SignupOtpVerifySchema = z.object({
  otpId: z.string().uuid(),
  mobile: z.string().min(8).max(20),
  otpCode: z.string().regex(/^\d{6}$/)
});

const normalizeMobile = (mobile: string): string => {
  const cleaned = mobile.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
};

const generateOtpCode = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const hashOtpCode = (otp: string): string => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const signAccessToken = (userId: string): string => {
  return jwt.sign({ sub: userId, type: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
};

const signRefreshToken = (userId: string): string => {
  return jwt.sign({ sub: userId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
};

export class AuthService {
  async requestSignupOtp(input: unknown): Promise<{ ok: boolean; otpId: string; expiresAt: string; otpCode?: string }> {
   
   
    const payload = SignupOtpRequestSchema.parse(input);
   
    const email = payload.email.toLowerCase();
    const mobile = normalizeMobile(payload.mobile);

    const existingUser = await db("users").where({ mobile }).orWhere({ email }).first();
    console.log("in here 01 payload", existingUser);
    if (existingUser) {
      throw Object.assign(new Error("Email or mobile already registered"), {
        status: 409,
        code: "AUTH_USER_EXISTS"
      });
    }

    const latestActive = await db("signup_otp_verifications")
      .where({ mobile, consumed_at: null })
      .andWhere("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .first();

    if (latestActive && latestActive.created_at) {
      const diffMs = Date.now() - new Date(latestActive.created_at).getTime();
      if (diffMs < env.OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        throw Object.assign(new Error("OTP requested too frequently"), {
          status: 429,
          code: "AUTH_OTP_COOLDOWN"
        });
      }
    }

    await db("signup_otp_verifications")
      .where({ mobile, consumed_at: null })
      .update({ consumed_at: new Date() });

    const otpCode = generateOtpCode();
    const [record] = await db("signup_otp_verifications")
      .insert({
        mobile,
        otp_hash: hashOtpCode(otpCode),
        expires_at: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        is_verified: false
      })
      .returning(["id", "expires_at"]);

    return {
      ok: true,
      otpId: record.id,
      expiresAt: new Date(record.expires_at).toISOString(),
      ...(env.NODE_ENV !== "production" ? { otpCode } : {})
    };
  }

  async verifySignupOtp(input: unknown): Promise<{ ok: boolean }> {
    const payload = SignupOtpVerifySchema.parse(input);
    const mobile = normalizeMobile(payload.mobile);
    const record = await db("signup_otp_verifications")
      .where({ id: payload.otpId, mobile, consumed_at: null })
      .first();

    if (!record) {
      throw Object.assign(new Error("OTP session not found"), {
        status: 400,
        code: "AUTH_OTP_INVALID"
      });
    }
    if (record.is_verified) {
      return { ok: true };
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      throw Object.assign(new Error("OTP expired"), {
        status: 400,
        code: "AUTH_OTP_EXPIRED"
      });
    }
    if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw Object.assign(new Error("OTP attempts exceeded"), {
        status: 429,
        code: "AUTH_OTP_ATTEMPTS_EXCEEDED"
      });
    }

    const expectedHash = hashOtpCode(payload.otpCode);
    if (expectedHash !== record.otp_hash) {
      await db("signup_otp_verifications")
        .where({ id: record.id })
        .update({ attempts: Number(record.attempts) + 1 });
      throw Object.assign(new Error("Invalid OTP"), {
        status: 400,
        code: "AUTH_OTP_INCORRECT"
      });
    }

    await db("signup_otp_verifications")
      .where({ id: record.id })
      .update({ is_verified: true, verified_at: new Date() });

    return { ok: true };
  }

  async signup(input: unknown): Promise<{
    ok: boolean;
    user: { id: string; email: string; name: string | null };
    organization: { id: string; name: string };
    membership: { role: string };
  }> {
    const payload = SignupSchema.parse(input);
    const email = payload.email.toLowerCase();
    const mobile = normalizeMobile(payload.mobile);
    const existing = await db("users").where({ email }).orWhere({ mobile }).first();

    if (existing) {
      throw Object.assign(new Error("Email or mobile already registered"), {
        status: 409,
        code: "AUTH_USER_EXISTS"
      });
    }

    const otpRecord = await db("signup_otp_verifications")
      .where({
        id: payload.otpId,
        mobile,
        is_verified: true,
        consumed_at: null
      })
      .andWhere("expires_at", ">", new Date())
      .first();

    if (!otpRecord) {
      throw Object.assign(new Error("OTP verification required"), {
        status: 400,
        code: "AUTH_OTP_NOT_VERIFIED"
      });
    }

    const result = await db.transaction(async (trx) => {
      const passwordHash = await bcrypt.hash(payload.password, 12);
      const [user] = await trx("users")
        .insert({
          email,
          mobile,
          password_hash: passwordHash,
          name: payload.name ?? null
        })
        .returning(["id", "email", "mobile", "name"]);

      const [organization] = await trx("organizations")
        .insert({
          name: payload.organizationName,
          owner_id: user.id,
          plan_id: "starter",
          timezone: "Asia/Kolkata",
          opt_out_keyword: "STOP",
          is_active: true
        })
        .returning(["id", "name"]);

      await trx("org_members").insert({
        org_id: organization.id,
        user_id: user.id,
        role: "admin",
        invited_by: user.id
      });
      await trx("signup_otp_verifications").where({ id: payload.otpId }).update({ consumed_at: new Date() });

      return {
        user,
        organization,
        membership: { role: "admin" }
      };
    });

    return { ok: true, ...result };
  }

  async login(input: unknown): Promise<{ ok: boolean; accessToken: string; refreshToken: string }> {
    const payload = LoginSchema.parse(input);
    const user = await db("users").where({ email: payload.email.toLowerCase() }).first();

    if (!user) {
      throw Object.assign(new Error("Invalid credentials"), {
        status: 401,
        code: "AUTH_INVALID_CREDENTIALS"
      });
    }

    const validPassword = await bcrypt.compare(payload.password, user.password_hash);
    if (!validPassword) {
      throw Object.assign(new Error("Invalid credentials"), {
        status: 401,
        code: "AUTH_INVALID_CREDENTIALS"
      });
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await db("refresh_tokens").insert({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    return { ok: true, accessToken, refreshToken };
  }

  async refresh(input: unknown): Promise<{ ok: boolean; accessToken: string; refreshToken: string }> {
    const payload = RefreshSchema.parse(input);
    const decoded = jwt.verify(payload.refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    const userId = String(decoded.sub || "");

    if (!userId) {
      throw Object.assign(new Error("Invalid refresh token"), {
        status: 401,
        code: "AUTH_INVALID_REFRESH"
      });
    }

    const tokens = await db("refresh_tokens")
      .where({ user_id: userId, revoked_at: null })
      .andWhere("expires_at", ">", new Date())
      .select(["id", "token_hash"]);

    const matched = await (async () => {
      for (const token of tokens) {
        const isMatch = await bcrypt.compare(payload.refreshToken, token.token_hash);
        if (isMatch) return token;
      }
      return null;
    })();

    if (!matched) {
      throw Object.assign(new Error("Invalid refresh token"), {
        status: 401,
        code: "AUTH_INVALID_REFRESH"
      });
    }

    await db("refresh_tokens").where({ id: matched.id }).update({ revoked_at: new Date() });

    const newAccessToken = signAccessToken(userId);
    const newRefreshToken = signRefreshToken(userId);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await db("refresh_tokens").insert({
      user_id: userId,
      token_hash: newRefreshTokenHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    return { ok: true, accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(input: unknown): Promise<{ ok: boolean }> {
    const payload = RefreshSchema.parse(input);
    const rows = await db("refresh_tokens").where({ revoked_at: null }).select(["id", "token_hash"]);

    for (const row of rows) {
      const isMatch = await bcrypt.compare(payload.refreshToken, row.token_hash);
      if (isMatch) {
        await db("refresh_tokens").where({ id: row.id }).update({ revoked_at: new Date() });
        break;
      }
    }

    return { ok: true };
  }

  async forgotPassword(input: unknown): Promise<{ ok: boolean }> {
    const payload = ForgotPasswordSchema.parse(input);
    const user = await db("users").where({ email: payload.email.toLowerCase() }).first();

    if (!user) {
      return { ok: true };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);

    await db("password_reset_tokens")
      .where({ user_id: user.id, used_at: null })
      .update({ used_at: new Date() });

    await db("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000)
    });

    // In production send this by email service. Returning token now for integration testing.
    return { ok: true };
  }

  async resetPassword(input: unknown): Promise<{ ok: boolean }> {
    const payload = ResetPasswordSchema.parse(input);
    const rows = await db("password_reset_tokens")
      .where({ used_at: null })
      .andWhere("expires_at", ">", new Date())
      .select(["id", "user_id", "token_hash"]);

    let matched: { id: string; user_id: string; token_hash: string } | null = null;
    for (const row of rows) {
      const isMatch = await bcrypt.compare(payload.token, row.token_hash);
      if (isMatch) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      throw Object.assign(new Error("Invalid or expired reset token"), {
        status: 400,
        code: "AUTH_RESET_TOKEN_INVALID"
      });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    await db("users").where({ id: matched.user_id }).update({ password_hash: passwordHash, updated_at: new Date() });
    await db("password_reset_tokens").where({ id: matched.id }).update({ used_at: new Date() });
    await db("refresh_tokens").where({ user_id: matched.user_id, revoked_at: null }).update({ revoked_at: new Date() });

    return { ok: true };
  }
}
