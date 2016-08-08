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
}

class ReactAst extends Ast {
    getComponents() {
        let components = this.queryAst(
            '[body] > [type="VariableDeclaration"] > [init.type="CallExpression"]'
        );
        return components.filter(a => {
            return a.getContents().init.callee.object.name === 'React'
                    && a.getContents().init.callee.property.name === 'createClass'
        });
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

        return null;
    }

    static isReactCreateElement(entry) {
        return entry.type === 'CallExpression' && AstHelper.extractExpression(entry) === 'React.createElement()';
    }

    static extractFunctionParameters(expr) {
        console.log('[AstHelper] extractFunctionParameters', expr);
        return expr.arguments.map(a => {
            return {
                type: a.type,
                value: AstHelper.extractExpression(a)
            };
        });
    }
}