import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { NumericFilterOperator, ValueType, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';
import { NUMERIC_OPERATORS, assertOperator } from './operators';

export class NumericMatch {
    isMatch = false;
    validPath = true;
    matchs: number[] = [];
    targets: number[];
    values: number[];
    constructor(
        private field: string,
        private operator: NumericFilterOperator,
        value: ValueType,
        private data: ObjectData,
    ) {
        const target = resolvePath(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targetVals = (Array.isArray(value) ? value : [value]).map((i) =>
            typeTransfer(i, 'number'),
        ) as number[];
        this.values = targetVals;
        const targets = [].concat(target).map((i) => typeTransfer(i, 'number'));
        this.targets = targets;
        if (_.isNull(target) || _.isUndefined(target)) {
            this.targets = [];
        }
        assertOperator('numeric', this.operator, NUMERIC_OPERATORS);
        this.isMatch = this[this.operator]();
    }

    private eq() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target == cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch =
                    this.targets.length > 0 &&
                    targetMatchs.length == this.targets.length;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount == this.values.length;
    }

    private neq() {
        // NaN-safe (parity with DateMatch.neq): an unparseable filter value
        // never counts as "absent", so a garbage value does not silently match.
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
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target > cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch = targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private gte() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target >= cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch = targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private lt() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target < cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch = targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private lte() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target <= cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch = targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private range() {
        if (this.values.length !== 2) {
            throw new Error(
                `[data-filter] range operator requires exactly 2 values, received ${this.values.length}`,
            );
        }
        const [lo, hi] = [...this.values].sort((a, b) => a - b);
        this.matchs = this.targets.filter(
            (target) => target >= lo && target <= hi,
        );
        return this.matchs.length > 0;
    }

    private terms() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target == cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch = targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <number[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }
}
