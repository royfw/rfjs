import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { DateFilterOperator, ValueType, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';

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

    if (typeof this[this.operator] == 'function') {
      this.isMatch = this[this.operator]();
    }
  }

  private toTimestamp(val: string | number | boolean | Date): number {
    const transferred = typeTransfer(val, 'date');
    return transferred instanceof Date ? transferred.getTime() : Number(transferred);
  }

  private eq() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length == this.values.length;
  }

  private neq() {
    const eqMatchs = this.values.filter((cur) => this.targets.includes(cur));
    this.matchs = this.values.filter((i) => !eqMatchs.includes(i));
    return this.matchs.length > 0;
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
    const sortVals = this.values.sort((a, b) => a - b);
    const start = sortVals[0];
    const end = sortVals[1];
    this.matchs = this.targets.filter((cur) => cur >= start && cur <= end);
    return this.matchs.length > 0;
  }

  private terms() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length > 0;
  }
}
