import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { BooleanFilterOperator, ValueType, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';
import { BOOLEAN_OPERATORS, assertOperator } from './operators';

export class BooleanMatch {
    isMatch = false;
    validPath = true;
    matchs: boolean[] = [];
    values: boolean[];
    targets: boolean[];
    constructor(
        private field: string,
        private operator: BooleanFilterOperator,
        value: ValueType,
        private data: ObjectData,
    ) {
        // 使用共用的路徑解析函數
        const target = resolvePath(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targets = ([] as unknown[])
            .concat(target as never)
            .map((i) => typeTransfer(i, 'boolean'));
        const transVals = (Array.isArray(value) ? value : [value]).map((i) =>
            typeTransfer(i, 'boolean'),
        );
        this.values = transVals;
        this.targets = targets;
        if (_.isNull(target) || _.isUndefined(target)) {
            this.targets = [];
        }
        assertOperator('boolean', this.operator, BOOLEAN_OPERATORS);
        this.isMatch = this[this.operator]();
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
        this.matchs = this.values.filter(
            (value) => !this.targets.includes(value),
        );
        return this.matchs.length === this.values.length;
    }
    private isnull() {
        return this.targets.length == 0;
    }
    private isnotnull() {
        return !this.isnull();
    }
}
