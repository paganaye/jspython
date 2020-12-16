import {
    ArrowFuncDefNode,
    AssignNode, AstBlock, AstNode, BinOpNode, BracketObjectAccessNode, ConstNode, CreateArrayNode,
    CreateObjectNode, DotObjectAccessNode, FunctionCallNode, FunctionDefNode, GetSingleVarNode, SetSingleVarNode
} from '../common';
import { Scope } from './scope';

type Primitive = string | number | boolean | null;
const OperationFuncs: Record<string, (l: Primitive, r: Primitive) => Primitive> = {
    "+": (l, r) => (l as number) + (r as number) as Primitive,
    "-": (l, r) => (l as number) - (r as number) as Primitive,
    "/": (l, r) => (l as number) / (r as number) as Primitive,
    "*": (l, r) => (l as number) * (r as number) as Primitive
}

export class Evaluator {


    evalBlock(ast: AstBlock, scope: Scope): unknown {
        let lastResult = null;

        for (let node of ast?.funcs || []) {
            const funcDef = node as FunctionDefNode;

            const ast = {
                name: '',
                type: 'func',
                funcs: [],
                body: funcDef.body
            } as AstBlock;

            // a child scope needs to be created here
            const newScope = scope;

            scope.set(funcDef.name, (...args: unknown[]): unknown => {

                // set parameters into new scope, based incomming arguments
                for (let i = 0; i < args?.length || 0; i++) {
                    if (i >= funcDef.params.length) {
                        break;
                        // throw new Error('Too much parameters provided');
                    }
                    newScope.set(funcDef.params[i], args[i]);
                }
                return this.evalBlock(ast, newScope);
            }
            );

        }

        for (const node of ast.body) {
            lastResult = this.evalNode(node, scope);
        }

        return lastResult;
    }

    private invokeFunction(func: (...args: unknown[]) => unknown, fps: unknown[]): unknown {
        if (fps.length === 0) { return func(); }
        if (fps.length === 1) { return func(fps[0]); }
        if (fps.length === 2) { return func(fps[0], fps[1]); }
        if (fps.length === 3) { return func(fps[0], fps[1], fps[2]); }
        if (fps.length === 4) {
            return func(fps[0], fps[1], fps[2], fps[3]);
        }
        if (fps.length === 5) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4]);
        }

        if (fps.length === 6) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4], fps[5]);
        }

        if (fps.length === 7) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4], fps[5], fps[6]);
        }

        if (fps.length === 8) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4], fps[5], fps[6], fps[7]);
        }

        if (fps.length === 9) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4], fps[5], fps[6], fps[7], fps[8]);
        }

        if (fps.length === 10) {
            return func(fps[0], fps[1], fps[2], fps[3], fps[4], fps[5], fps[6], fps[7], fps[8], fps[9]);
        }

        if (fps.length > 10) {
            throw Error('Function has too many parameters. Current limitation is 10');
        }
    }

    private evalNode(node: AstNode, scope: Scope): unknown {
        if (node.type === "const") {
            return (node as ConstNode).value;
        }

        if (node.type === "getSingleVar") {
            return scope.get((node as GetSingleVarNode).name);
        }

        if (node.type === "binOp") {
            const binOpNode = (node as BinOpNode);
            var left = this.evalNode(binOpNode.left, scope);
            var right = this.evalNode(binOpNode.right, scope);
            return OperationFuncs[binOpNode.op](left as Primitive, right as Primitive);
        }

        if(node.type === "arrowFuncDef") {
            const arrowFuncDef = node as ArrowFuncDefNode;

            const newScope = scope;
            const ast = {
                name: '',
                type: 'func',
                funcs: [],
                body: arrowFuncDef.body
            } as AstBlock;

            const arrowFuncHandler = (...args: unknown[]): unknown => {
                // set parameters into new scope, based incomming arguments
                for (let i = 0; i < args?.length || 0; i++) {
                    if (i >= arrowFuncDef.params.length) {
                        break;
                        // throw new Error('Too much parameters provided');
                    }
                    newScope.set(arrowFuncDef.params[i], args[i]);
                }
                return this.evalBlock(ast, newScope);              
            }

            return arrowFuncHandler;
        }

        if (node.type === "funcCall") {
            const funcCallNode = node as FunctionCallNode;
            const func = scope.get(funcCallNode.name) as (...args: unknown[]) => unknown;
            const pms = funcCallNode.paramNodes?.map(n => this.evalNode(n, scope)) || []

            return this.invokeFunction(func, pms);
        }

        if (node.type === "assign") {
            const assignNode = node as AssignNode;

            if (assignNode.target.type === 'getSingleVar') {
                const node = assignNode.target as SetSingleVarNode;
                scope.set(node.name, this.evalNode(assignNode.source, scope));
            } else if (assignNode.target.type === 'dotObjectAccess') {
                const targetNode = assignNode.target as DotObjectAccessNode;

                // create a node for all but last property token
                // potentially it can go to parser
                const targetObjectNode = new DotObjectAccessNode(targetNode.nestedProps.slice(0, targetNode.nestedProps.length - 1));
                const targetObject = this.evalNode(targetObjectNode, scope) as Record<string, unknown>;

                // not sure nested properties should be GetSingleVarNode
                // can be factored in the parser
                const lastPropertyName = (targetNode.nestedProps[targetNode.nestedProps.length - 1] as GetSingleVarNode).name

                targetObject[lastPropertyName] = this.evalNode(assignNode.source, scope);
            } else {
                throw Error('Not implemented Assign operation');
                // get chaining calls
            }

            return null;
        }

        if (node.type === 'bracketObjectAccess') {
            const sbNode = node as BracketObjectAccessNode;
            const key = this.evalNode(sbNode.bracketBody, scope) as string;
            const obj = scope.get(sbNode.propertyName as string) as Record<string, unknown>;
            return obj[key];
        }

        if (node.type === "dotObjectAccess") {
            const dotObject = node as DotObjectAccessNode;

            let startObject = this.evalNode(dotObject.nestedProps[0], scope) as any;
            for (let i = 1; i < dotObject.nestedProps.length; i++) {

                if (dotObject.nestedProps[i].type === 'getSingleVar') {
                    startObject = startObject[(dotObject.nestedProps[i] as SetSingleVarNode).name] as unknown;
                } else if (dotObject.nestedProps[i].type === 'bracketObjectAccess') {
                    const node = dotObject.nestedProps[i] as BracketObjectAccessNode;
                    startObject = startObject[node.propertyName] as unknown;
                    startObject = startObject[this.evalNode(node.bracketBody, scope) as string] as unknown;
                } else if (dotObject.nestedProps[i].type === 'funcCall') {
                    const funcCallNode = dotObject.nestedProps[i] as FunctionCallNode;
                    const func = startObject[funcCallNode.name] as (...args: unknown[]) => unknown;
                    const pms = funcCallNode.paramNodes?.map(n => this.evalNode(n, scope)) || []

                    startObject = this.invokeFunction(func.bind(startObject), pms);

                } else {
                    throw Error("Can't resolve dotObjectAccess node")
                }
            }

            return startObject;
        }

        if (node.type === 'createObject') {
            const createObjectNode = node as CreateObjectNode;
            const obj = {} as Record<string, unknown>;

            for (const p of createObjectNode.props) {
                obj[this.evalNode(p.name, scope) as string] = this.evalNode(p.value, scope);
            }

            return obj;
        }

        if (node.type === 'createArray') {
            const arrayNode = node as CreateArrayNode;
            const res = [] as unknown[];

            for (const item of arrayNode.items) {
                res.push(this.evalNode(item, scope));
            }

            return res;
        }

    }


}