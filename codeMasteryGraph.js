d3.json('data_flow.json').then(data => {
  const width = window.innerWidth * 0.9;  
  const height = window.innerHeight * 0.9; 


  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const svg = d3.select('body')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [0, 0, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Create a group for the graph elements
  const g = svg.append('g');

  // Add zoom and pan behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', function(e) {
      g.attr('transform', e.transform);
    });

  svg.call(zoom);

  // Initialize the simulation
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links)
      .id(d => d.name)
      .distance(75))
    .force('charge', d3.forceManyBody()
      .strength(-50))
    .force('center', d3.forceCenter(width / 2, height / 2));

  // Create the links
  const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(data.links)
    .join('line')
    .attr('stroke-width', 1)
    .attr('class', 'link');

  // Add tooltips to links
  link.append('title')
    .text(d => `Type: ${d.type}\nFile: ${d.file}\nLine: ${d.loc.start.line}`);

  // Create the nodes
  const node = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(data.nodes)
    .join('g')
    .attr('class', 'node');

  const circles = node.append('circle')
    .attr('r', 5)
    .attr('fill', d => color(d.type));

  // Add tooltips to nodes
  circles.append('title')
    .text(d => `Name: ${d.name}\nType: ${d.type}`);

  const labels = node.append('text')
    .text(d => d.name)
    .attr('x', 6)
    .attr('y', 3);

  // Apply drag behavior to nodes
  node.call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended));

  // prevents node clicks from zooming (not sure why the default behavior is this)
  node.on('click', function(e) {
    e.stopPropagation();
  });

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(e, d) {
    if (!e.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(e, d) {
    d.fx = e.x;
    d.fy = e.y;
  }

  function dragended(e, d) {
    if (!e.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
});

function resize() {
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;

  svg.attr('width', newWidth)
    .attr('height', newHeight)
    .attr('viewBox', [0, 0, newWidth, newHeight]);
}

window.addEventListener('resize', resize);
