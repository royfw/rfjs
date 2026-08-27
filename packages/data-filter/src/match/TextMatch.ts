import _ from 'lodash';
import { typeTransfer } from '../filter/matchQuery';
import type { TextFilterOperator, ValueType, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';
import { STRING_OPERATORS, assertOperator } from './operators';

export class TextMatch {
    isMatch = false;
    validPath = true;
    matchs: string[] = [];
    targets: string[];
    values: string[];
    constructor(
        private field: string,
        private operator: TextFilterOperator,
        value: ValueType,
        private data: ObjectData,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const target = resolvePath(this.data, this.field);
        if (_.isUndefined(target)) {
            this.validPath = false;
        }
        const targetVals: string[] = (Array.isArray(value) ? value : [value]).map((i) => typeTransfer(i, 'string') as string);
        this.values = targetVals;
        const targets: string[] = (Array.isArray(target) ? target : [target]).map((i) => typeTransfer(i, 'string') as string);
        this.targets = targets;
        if (_.isNull(target) || _.isUndefined(target)) {
            this.targets = [];
        }
        assertOperator('string', this.operator, STRING_OPERATORS);
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
            <string[]>[],
        );
        const isMatchCount = this.matchs.length;
        return isMatchCount == this.values.length;
    }

    private neq() {
        // Matches only when every filter value is ABSENT from the resolved
        // targets. On a single-value field this is a plain "not equal"; on an
        // array/wildcard field it correctly rejects rows that contain the value
        // (the old `!eq()` used forall semantics and wrongly matched a present
        // value). Consistent with the other Match classes.
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

    // Case-insensitive `contains`. Same contains-any semantics as `contains`
    // (match if any target substring-contains any value), but both sides are
    // lower-cased before comparison. Operands are coerced with `String(...)`
    // first so a numeric/boolean/date value never throws. See issues #268/#266.
    private icontains() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const needle = String(cur).toLowerCase();
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = String(target)
                            .toLowerCase()
                            .includes(needle);
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

    // Case-insensitive equality (mirror of `eq`, both sides `String(...)`-coerced
    // then lower-cased so non-string operands never throw). #268/#279/#266.
    private ieq() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const needle = String(cur).toLowerCase();
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = String(target).toLowerCase() == needle;
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

    // Case-insensitive inequality (mirror of `neq`, both sides `String(...)`-coerced
    // then lower-cased so non-string operands never throw).
    private ineq() {
        const lowerTargets = this.targets.map((t) => String(t).toLowerCase());
        this.matchs = this.values.filter(
            (value) => !lowerTargets.includes(String(value).toLowerCase()),
        );
        return this.matchs.length === this.values.length;
    }

    // Case-insensitive prefix match (mirror of `startswith`, both sides
    // `String(...)`-coerced then lower-cased so non-string operands never throw).
    private istartswith() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const needle = String(cur).toLowerCase();
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = String(target)
                            .toLowerCase()
                            .startsWith(needle);
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

    // Case-insensitive suffix match (mirror of `endswith`, both sides
    // `String(...)`-coerced then lower-cased so non-string operands never throw).
    private iendswith() {
        this.matchs = this.values.reduce(
            (pre, cur) => {
                const needle = String(cur).toLowerCase();
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        const isTargetMatch = String(target)
                            .toLowerCase()
                            .endsWith(needle);
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
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        // Compare literally; the value may contain regex
                        // metacharacters and must not be treated as a pattern.
                        const isTargetMatch = target.startsWith(cur);
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
                const targetMatchs = this.targets.reduce(
                    (tarPre, target) => {
                        // Compare literally; the value may contain regex
                        // metacharacters and must not be treated as a pattern.
                        const isTargetMatch = target.endsWith(cur);
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
