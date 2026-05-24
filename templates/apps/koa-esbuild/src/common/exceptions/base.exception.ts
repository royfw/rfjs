import { EnumErrorCode } from '@/common/enums';

export class BaseException extends Error {
  protected _errorCode: EnumErrorCode = EnumErrorCode.BASE_ERROR;

  /**
   * Instantiate a plain Base Exception.
   *
   * @example
   * `throw new BaseException()`
   *
   */
  constructor(
    protected _message: string,
    protected _description?: string,
  ) {
    super();
  }

  get errorCode() {
    return this._errorCode;
  }

  get message() {
    return this._message;
  }

  get description() {
    return this._description ?? '';
  }
}
