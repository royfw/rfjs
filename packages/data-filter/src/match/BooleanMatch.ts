import * as _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { BooleanFilterOperator, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';

export class BooleanMatch {
    isMatch = false;
    validPath = true;
    matchs: boolean[] = [];
    values: boolean[];
    targets: boolean[];
    constructor(
        private field: string,
        private operator: BooleanFilterOperator,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any,
        private data: ObjectData,
    ) {
        // 使用共用的 JSONPath 解析函數
        const target = resolvePath(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targets = []
            .concat(target)
            .map((i) => typeTransfer(i, 'boolean'));
        const transVals = []
            .concat(value)
            .map((i) => typeTransfer(i, 'boolean'));
        this.values = transVals;
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
                let isMatch = false;
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = target == cur;
                        if (isTargetMatch) tarPre.push(isTargetMatch);
                        return tarPre;
                    },
                    <boolean[]>[],
                );
                isMatch =
                    this.targets.length > 0 &&
                    targetMatchs.length == this.targets.length;
                if (isMatch) pre.push(cur);
                return pre;
            },
            <boolean[]>[],
        );
        return this.matchs.length == this.values.length;
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
}
