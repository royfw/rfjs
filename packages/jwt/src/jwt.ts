import {
  sign,
  verify,
  decode,
  JwtPayload,
  VerifyErrors,
  SignOptions,
  VerifyOptions,
} from 'jsonwebtoken';

export type Secret = string | Buffer;

/** Payload accepted by {@link Jwt.createToken}. Note: a `string`/`Buffer`
 * payload is incompatible with the `expiresIn`/`notBefore`/`audience` claims
 * and `jsonwebtoken` will throw if they are combined. */
export type SignPayload = string | Buffer | object;

/**
 * https://github.com/auth0/node-jsonwebtoken?tab=readme-ov-file#jsonwebtokenerror
 *
 * name: 'JsonWebTokenError'
 * message:
 *  'invalid token' - the header or payload could not be parsed
 *  'jwt malformed' - the token does not have three components (delimited by a .)
 *  'jwt signature is required'
 *  'invalid signature'
 *  'jwt audience invalid. expected: [OPTIONS AUDIENCE]'
 *  'jwt issuer invalid. expected: [OPTIONS ISSUER]'
 *  'jwt id invalid. expected: [OPTIONS JWT ID]'
 *  'jwt subject invalid. expected: [OPTIONS SUBJECT]'
 */
export type JsonWebTokenErrorMessages =
  | 'invalid token'
  | 'jwt malformed'
  | 'jwt signature is required'
  | 'invalid signature'
  | 'jwt audience invalid. expected: [OPTIONS AUDIENCE]'
  | 'jwt issuer invalid. expected: [OPTIONS ISSUER]'
  | 'jwt id invalid. expected: [OPTIONS JWT ID]'
  | 'jwt subject invalid. expected: [OPTIONS SUBJECT]';

/**
 * name: 'NotBeforeError'
 * message: 'jwt not active'
 * date: 2018-10-04T16:10:44.000Z
 */
export type NotBeforeErrorMessages = 'jwt not active';

/**
 * name: 'TokenExpiredError'
 * message: 'jwt expired'
 * expiredAt: [ExpDate]
 */
export type TokenExpiredErrorMessages = 'jwt expired';

/**
 * Result of {@link Jwt.verifyToken}, modelled as a discriminated union on
 * `success`. On failure the token could not be verified, so `payload` is the
 * best-effort decoded value and may be `null` (e.g. for a malformed token).
 *
 * `errMsg` is the raw `Error.message` from `jsonwebtoken`; the documented
 * messages above are a guide, but messages such as audience/issuer/subject
 * errors embed the expected value at runtime, so the type is `string`.
 */
export type VerifyJWTResult<T = JwtPayload> =
  | { success: true; payload: T; err?: undefined; errMsg?: undefined }
  | { success: false; payload: T | null; err: VerifyErrors; errMsg: string };

export class Jwt {
  constructor(
    private secret: Secret,
    private option: SignOptions = {
      expiresIn: 60 * 60,
    },
  ) {}

  static initial(secret: Secret, option?: SignOptions): Jwt {
    return new Jwt(secret, option);
  }

  createToken(
    payload: SignPayload,
    options: SignOptions = { expiresIn: this.option.expiresIn },
  ): string {
    return sign(payload, this.secret, {
      ...this.option,
      ...options,
    });
  }

  decodeToken<T = JwtPayload>(token: string): T | null {
    return decode(token) as T | null;
  }

  verifyToken<T = JwtPayload>(
    token: string,
    option?: VerifyOptions,
  ): VerifyJWTResult<T> {
    try {
      const payload = verify(token, this.secret, option) as T;
      return {
        success: true,
        payload,
      };
    } catch (err) {
      const payload = this.decodeToken<T>(token);
      return {
        success: false,
        payload,
        err: err as VerifyErrors,
        errMsg: (err as Error).message,
      };
    }
  }
}
