const acorn = require('acorn');
const walk = require('acorn-walk');
const jsx = require('acorn-jsx');
const  { make } = walk;

const baseVisitor = walk.base;
//we need this because we have to extend the acorn-walk class to have our custom node typing for jsx. 
const customWalker = make({ //needed because by default the acorn-walk does not have any support for node types specific to JSX (JSXElement, JSXText ...)
  ...baseVisitor,
  JSXElement(node, st, c) {
    c(node.openingElement, st);
    node.children.forEach(child => c(child, st));
    if (node.closingElement) {
      c(node.closingElement, st);
    }
  },
  JSXFragment(node, st, c) {
    node.children.forEach(child => c(child, st));
  },
  JSXOpeningElement(node, st, c) {
    c(node.name, st);
    node.attributes.forEach(attr => c(attr, st));
  },
  JSXClosingElement(node, st, c) {
    c(node.name, st);
  },
  JSXOpeningFragment(node, st, c){
    //no children to traverse
  },
  JSXClosingFragment(node, st, c) {
    //no children to traverse
  },
  JSXAttribute(node, st, c) {
    c(node.name, st);
    if (node.value) {
      c(node.value, st);
    }
  },
  JSXExpressionContainer(node, st, c) {
    c(node.expression, st);
  },
  JSXSpreadAttribute(node, st, c) {
    c(node.argument, st);
  },
  JSXSpreadChild(node, st, c) {
    c(node.expression, st);
  },
  JSXEmptyExpression(node, st, c) {
    // No child nodes
  },
  JSXIdentifier() {
    // No action needed
  },
  JSXNamespacedName(node, st, c) {
    c(node.namespace, st);
    c(node.name, st);
  },
  JSXMemberExpression(node, st, c) {
    c(node.object, st);
    c(node.property, st);
  },
  ExportDefaultDeclaration(node, st, c) {
    if (node.declaration) c(node.declaration, st);
  },
  // handles all other exports
  ExportNamedDeclaration(node, st, c) {
    if (node.declaration) c(node.declaration, st);
    if (node.source) c(node.source, st);
    node.specifiers.forEach(specifier => c(specifier, st));
  },
  ImportDeclaration(node, st, c) {
    node.specifiers.forEach(specifier => c(specifier, st));
    c(node.source, st);
  },
  FunctionDeclaration(node, st, c) {
    if (node.id) c(node.id, st);
    node.params.forEach(param => c(param, st));
    c(node.body, st);
  },
  ClassDeclaration(node, st, c) {
    if (node.id) c(node.id, st);
    if (node.superClass) c(node.superClass, st);
    c(node.body, st);
  },
  JSXText() {
    // No action needed
  },
  [Symbol.for('unknown')]: (node, st, c) => {
    // this is for any unknown types I didnt catch yet
    console.warn(`Unhandled node type: ${node.type}`);
  },
});

const wrappedWalker = new Proxy(customWalker, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    } else if (typeof prop === 'string') {
      return function(node, st, c) {
        console.warn(`No handler for node type: ${prop} at line ${node.loc ? node.loc.start.line : 'unknown'}`);
        if (baseVisitor[prop]) {
          // Use the base visitor if it exists
          baseVisitor[prop](node, st, c);
        } else {
          console.error(`No base visitor for node type: ${prop}`);
        }
      };
    } else {
      return target[prop];
    }
  },
});

module.exports = {
  wrappedWalker,
};