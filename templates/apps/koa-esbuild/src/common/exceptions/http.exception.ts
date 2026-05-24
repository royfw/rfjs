import { EnumErrorCode } from '@/common/enums';
import { BaseException } from './base.exception';
import { HttpError } from '@/common/types';
import httpStatus from 'http-status';

export class HttpException extends BaseException {
  protected _errorCode: EnumErrorCode = EnumErrorCode.HTTP_BASE_ERROR;

  get status() {
    return Number(this._status);
  }

  get type(): string {
    return String(httpStatus[this._status] || 'Unknown Error');
  }
  /**
   * Instantiate a plain HTTP Exception.
   *
   * @example
   * `throw new HttpException()`
   *
   */
  constructor(
    message?: string,
    protected _status?: number,
    description?: string,
  ) {
    _status = _status ?? httpStatus.BAD_REQUEST;
    message = message?.length ? message : String(httpStatus[_status] || 'Unknown Error');
    super(message, description);
    this._status = _status;
  }

  get errorInfo(): HttpError {
    return {
      status: this.status,
      type: this.type,
      message: this.message,
      description: this.description,
      errorCode: this.errorCode,
      error: this,
      stack: this.stack,
    };
  }
}
