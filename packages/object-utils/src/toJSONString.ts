/**
 * convert object to Json string
 * @param obj object
 * @param _isPretty
 * @returns
 */
export function toJSONString(obj: object, _isPretty = false): string {
  if (_isPretty) {
    return JSON.stringify(obj, null, 2);
  }
  return JSON.stringify(obj);
}
