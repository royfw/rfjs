export enum EnumErrorCode {
  /**
   * UNKNOWN_ERROR
   */
  UNKNOWN_ERROR = 'unknown_error',

  /**
   * BASE_ERROR
   */
  BASE_ERROR = 'base_error',

  /**
   * base http error
   */
  HTTP_BASE_ERROR = 'http_base_error',

  /**
   * http access token denied
   */
  ACCESS_TOKEN_NOT_VALID = 'access_token_denied',

  /**
   * data not found
   */
  NOT_FOUND = 'not_found',

  /***
   * request permission denied
   */
  PERMISSION_DENIED = 'permission_denied',

  /**
   * base database error
   */
  DB_ERROR = 'db_error',
}
