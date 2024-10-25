function extractDeclaredVariables(node) {
  const variables = [];

  const extract = (n) => {
    if (n.type === 'Identifier') {
      variables.push(n.name);
    } else if (n.type === 'ObjectPattern') {
      n.properties.forEach(prop => {
        if (prop.type === 'Property') {
          extract(prop.value);
        } else if (prop.type === 'RestElement') {
          extract(prop.argument);
        }
      });
    } else if (n.type === 'ArrayPattern') {
      n.elements.forEach(elem => {
        if (elem) { // elem can be null in cases like [,,a]
          extract(elem);
        }
      });
    } else if (n.type === 'RestElement') {
      extract(n.argument);
    } else if (n.type === 'AssignmentPattern') {
      extract(n.left);
    }
    // Add more cases if needed
  };

  extract(node);
  return variables;
}

module.exports = {
  extractDeclaredVariables,
};