import {
  sign,
  verify,
  decode,
  VerifyErrors,
  SignOptions,
  VerifyOptions,
} from 'jsonwebtoken';

export type Secret = string | Buffer;

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

export interface VerifyJWTResult<T = any> {
  success: boolean;
  payload: T;
  err?: VerifyErrors | null;
  errMsg?:
    | JsonWebTokenErrorMessages
    | NotBeforeErrorMessages
    | TokenExpiredErrorMessages;
}

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
    payload: any,
    options: SignOptions = { expiresIn: this.option.expiresIn },
  ): string {
    return sign(payload, this.secret, {
      ...this.option,
      ...options,
    });
  }

  decodeToken<T = any>(token: string): T {
    const payload = decode(token) as T;
    return payload;
  }

  verifyToken<T = any>(
    token: string,
    option?: VerifyOptions,
  ): VerifyJWTResult<T> {
    try {
      const payload = verify(token, this.secret, option) as T;
      return {
        success: true,
        payload,
      };
    } catch (err: any) {
      const payload = this.decodeToken<T>(token);
      return {
        success: false,
        payload,
        err,
        errMsg: err.message,
      };
    }
  }
}
