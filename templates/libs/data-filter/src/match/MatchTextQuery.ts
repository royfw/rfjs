import * as _ from 'lodash';
import { typeTransfer } from '../filter/filterMatchQueryData';
import type { TextFilterOperator, DefaultFilterOperator, ObjectData } from '../types';
import { resolvePathWithWildcard } from '../path/resolve';

export class MatchTextQuery {
    isMatch = false;
    validPath = true;
    matchs: string[] = [];
    targets: string[];
    values: string[];
    constructor(
        private field: string,
        private operator: TextFilterOperator | DefaultFilterOperator,
        value: any,
        private data: ObjectData,
    ) {
        const target = resolvePathWithWildcard(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targetVals = []
            .concat(value)
            .map((i) => typeTransfer(i, 'string')) as string[];
        this.values = targetVals;
        const targets = [].concat(target).map((i) => typeTransfer(i, 'string'));
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
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount == this.values.length;
    }

    private neq() {
        const isMatch = !this.eq();
        const neqMatchs = this.values.filter((i) => !this.matchs.includes(i));
        this.matchs = neqMatchs;
        return isMatch;
    }

    private isnull() {
        return this.targets.length == 0;
    }

    private isnotnull() {
        return !this.isnull();
    }

    private contains() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target.includes(cur);
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch =
                    this.targets.length > 0 && targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private startswith() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const replace = `^${cur}`;
                const regex = new RegExp(replace, 'g');
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const found = target.match(regex);
                        const isTargetMatch = found ? found.length > 0 : false;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch =
                    this.targets.length > 0 && targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }

    private endswith() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const replace = `${cur}$`;
                const regex = new RegExp(replace, 'g');
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const found = target.match(regex);
                        const isTargetMatch = found ? found.length > 0 : false;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                const isMatch =
                    this.targets.length > 0 && targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
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
                const isMatch =
                    this.targets.length > 0 && targetMatchs.length > 0;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount > 0;
    }
}
