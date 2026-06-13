/**
 * Stable discriminant for every error this package throws. A thrown
 * `JsonbQueryError` always signals a caller-input problem; any other thrown
 * type is an internal bug.
 */
export type JsonbQueryErrorCode =
  | 'INVALID_COLUMN'        // column identifier is not a plain (qualified) reference
  | 'INVALID_DIALECT'       // unknown dialect name
  | 'UNSUPPORTED_OPERATOR'  // operator not valid for the (element) type
  | 'INVALID_ELEMENT_TYPE'  // unknown array elementType
  | 'INVALID_SCALAR_VALUE'  // operator expected a single scalar value
  | 'INVALID_ARRAY_VALUE'   // operator expected an array of a given arity / non-empty
  | 'INVALID_OBJECT_VALUE'  // operator expected a plain object value
  | 'EMPTY_FILTER_GROUP'    // elemmatch requires a group with >= 1 condition
  | 'INVALID_PREFIX'        // named-parameter prefix is not a valid identifier
  | 'PARAM_MISMATCH';       // toNamedParams: placeholders do not match the values array

export class JsonbQueryError extends Error {
  readonly code: JsonbQueryErrorCode;

  constructor(message: string, code: JsonbQueryErrorCode) {
    super(message);
    this.name = 'JsonbQueryError';
    this.code = code;
  }
}
