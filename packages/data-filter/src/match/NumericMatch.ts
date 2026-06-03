import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { NumericFilterOperator, DefaultFilterOperator, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';

export class NumericMatch {
    isMatch = false;
    validPath = true;
    matchs: number[] = [];
    targets: number[];
    values: number[];
    constructor(
        private field: string,
        private operator: NumericFilterOperator | DefaultFilterOperator,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any,
        private data: ObjectData,
    ) {
        const target = resolvePath(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targetVals = []
            .concat(value)
            .map((i) => typeTransfer(i, 'number')) as number[];
        this.values = targetVals;
        const targets = [].concat(target).map((i) => typeTransfer(i, 'number'));
        this.targets = targets;
        if (_.isNull(target) || _.isUndefined(target)) {
            this.targets = [];
        }
        if (typeof this[this.operator] == 'function') {
            this.isMatch = this[this.operator]();
        }
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
        const neq = !this.eq();
        const neqMatchs = this.values.filter((i) => !this.matchs.includes(i));
        this.matchs = neqMatchs;
        return neq;
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
        const sortVals = this.values.sort((a, b) => a - b);
        const s = sortVals[0];
        const b = sortVals[1];
        const matchs = this.targets.reduce(
            (pre, cur) => {
                if (cur >= s && cur <= b) {
                    pre.push(true);
                }
                return pre;
            },
            <boolean[]>[],
        );
        const isMatchCount = matchs.length;
        return isMatchCount > 0;
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
