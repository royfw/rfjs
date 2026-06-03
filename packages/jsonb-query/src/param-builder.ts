export class ParamBuilder {
  private _values: unknown[] = [];

  constructor(private readonly offset = 0) {}

  add(value: unknown): string {
    this._values.push(value);
    return `$${this.offset + this._values.length}`;
  }

  get values(): unknown[] {
    return [...this._values];
  }
}
