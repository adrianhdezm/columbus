'use strict';

class Ast {
    constructor(value) {
        this.value = value;
    }

    getContents() {
        return this.value;
    }

    asJson() {
        return JSON.stringify(this.value, null, '\t');
    }

    /**
     * @param  {string} query
     * @return {Ast[]}
     */
    queryAst(query) {
        console.log('[QueryAST] ', query);
        let selectorAst = esquery.parse(query);
        let matches = esquery.match(this.value, selectorAst);
        return matches.map(a => new Ast(a));
    }

    /**
     * @param  {string} query
     * @return {Ast}
     */
    querySingleAst(query) {
        console.log('[QuerySingleAst] ', query);
        let selectorAst = esquery.parse(query);
        let matches = esquery.match(this.value, selectorAst);
        if (matches.length > 0) {
            return new Ast(matches[0]);
        }
        return null;
    }
}

class ReactAst extends Ast {
    getComponents() {
        let components = this.queryAst(
            '[body] > [type="VariableDeclaration"] > [init.type="CallExpression"][init.callee.property.name="createClass"]'
        );

        let components2 = this.queryAst(
            '[body] [right.type="CallExpression"][right.callee.property.name="createClass"]'
        );

        let allComponents = components.concat(components2);

        return allComponents.map(a => new ReactAst(a.getContents()));
    }
    getName() {
        if (this.getContents().left && this.getContents().left.type === 'MemberExpression') {
            return this.getContents().left.property.name;
        }
        return this.getContents().id.name;
    }
}

class PolymerAst extends Ast {
    getComponents() {
        let components = this.queryAst(
            '[body] [type=CallExpression][callee.type="SequenceExpression"]'
        ).filter(a => a.getContents().callee.expressions[1].property.name="default");

        let components2 = this.queryAst(
            '[body] [type=CallExpression][callee.name=Polymer]'
        );

        let allComponents = components.concat(components2);

        return allComponents
            .map(a => new PolymerAst(a.getContents()));
    }
    getName() {
        let name = this.queryAst(
            '[type=Property][key.type=Identifier][key.name=is]'
        );
        return name[0].getContents().value.value;
    }
}

class AngularAst extends Ast {
    getComponents() {
        let components = this.queryAst(
            '[type="ExpressionStatement"] [callee.property.name=component]'
        );
        return components.map(a => new AngularAst(a.getContents()));
    }
    getName() {
        return this.getContents().arguments[0].value;
    }
}

class AstHelper {
    static extractExpression(expr) {
        let type = expr.type;

        if (type === 'ThisExpression') {
            return 'this';
        }

        if (type === 'Identifier') {
            return expr.name;
        }

        if (type === 'Literal') {
            return expr.value;
        }

        if (type === 'MemberExpression') {
            return this.extractExpression(expr.object) + '.'+expr.property.name;
        }

        if (type === 'CallExpression') {
            return this.extractExpression(expr.callee) + '()';
        }

        if (type === 'ArrayExpression') {
            return expr.elements.map(a => this.extractExpression(a));
        }

        if (type === 'ObjectExpression') {
            let foo = {};
            expr.properties.forEach(a => {
                return foo[this.extractExpression(a.key)] = this.extractExpression(a.value)
            });
            return foo;
        }

        return null;
    }

    static isReactCreateElement(entry) {
        return entry.type === 'CallExpression'
            && (AstHelper.extractExpression(entry).endsWith('.default.createElement()')
                    || AstHelper.extractExpression(entry) === ('React.createElement()'));
    }

    static extractFunctionParameters(expr) {
        if (expr.arguments === undefined || expr.arguments.length === 0) {
            return undefined;
        }

        return expr.arguments.map(a => {
            return {
                type: a.type,
                value: AstHelper.extractExpression(a)
            };
        });
    }

    static isReactCode(code)  {
        let checker = code.querySingleAst('[callee.property.name="createClass"]');

        if (!checker) return false;

        let check1 = checker.querySingleAst('[callee.object.name="React"]');
        if (check1 !== null) return true;

        let check2 = checker.querySingleAst('[callee.object.property.name="default"]');
        if (check2 !== null) return true;

        return false;
    }

    static isAngularCode(code)  {
        let checker = code.querySingleAst('[type="ExpressionStatement"] [callee.property.name=component]');
        return checker !== null;
    }

    static isPolymerCode(code)  {
        let checker = code.querySingleAst('[body] [type=CallExpression][callee.type="SequenceExpression"] [property.name="default"]');

        if (checker === null) {
            checker = code.querySingleAst('[body] [type=CallExpression][callee.name=Polymer]');
        }

        return checker !== null;
    }
}