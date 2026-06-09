import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { DateFilterOperator, ValueType, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';
import { DATE_OPERATORS, assertOperator } from './operators';

export class DateMatch {
  isMatch = false;
  validPath = true;
  matchs: number[] = [];
  targets: number[];
  values: number[];

  constructor(
    private field: string,
    private operator: DateFilterOperator,
    value: ValueType,
    private data: ObjectData,
  ) {
    const target = resolvePath(this.data, this.field);
    if (_.isUndefined(target)) {
      this.validPath = false;
    }

    this.values = (Array.isArray(value) ? value : [value]).map((i) =>
      this.toTimestamp(i),
    );

    const targets = [].concat(target).map((i) => this.toTimestamp(i));
    this.targets = targets;

    if (_.isNull(target) || _.isUndefined(target)) {
      this.targets = [];
    }

    assertOperator('date', this.operator, DATE_OPERATORS);
    this.isMatch = this[this.operator]();
  }

  private toTimestamp(val: string | number | boolean | Date): number {
    const transferred = typeTransfer(val, 'date');
    return transferred instanceof Date ? transferred.getTime() : Number(transferred);
  }

  private eq() {
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && this.targets.includes(value),
    );
    return this.matchs.length === this.values.length;
  }

  private neq() {
    // value-absent + NaN-safe: an unparseable (NaN) filter value never matches.
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && !this.targets.includes(value),
    );
    return this.matchs.length === this.values.length;
  }

  private isnull() {
    return this.targets.length == 0;
  }

  private isnotnull() {
    return !this.isnull();
  }

  private gt() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t > cur));
    return this.matchs.length > 0;
  }

  private gte() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t >= cur));
    return this.matchs.length > 0;
  }

  private lt() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t < cur));
    return this.matchs.length > 0;
  }

  private lte() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t <= cur));
    return this.matchs.length > 0;
  }

  private range() {
    if (this.values.length !== 2) {
      throw new Error(
        `[data-filter] range operator requires exactly 2 values, received ${this.values.length}`,
      );
    }
    const [lo, hi] = [...this.values].sort((a, b) => a - b);
    this.matchs = this.targets.filter((target) => target >= lo && target <= hi);
    return this.matchs.length > 0;
  }

  private terms() {
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && this.targets.includes(value),
    );
    return this.matchs.length > 0;
  }
}
