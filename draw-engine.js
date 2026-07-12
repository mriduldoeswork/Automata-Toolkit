/**
 * @fileoverview D3.js Visualization Engine.
 * Handles the rendering of automaton graphs using a physics-based force simulation.
 * Includes advanced logic for dynamic canvas resizing, self-loop SVG paths, 
 * bidirectional edge curves, and real-time state/edge highlighting during tape simulation.
 */

import { automata } from './state.js';

/** @constant {number} Radius of the state circles in the D3 visualization. */
const radius = 35;
/** @constant {number} Visual offset used for calculating self-loop arc paths. */
const loopOffset = 50;

/** @type {Object.<string, d3.Simulation>} Dictionary storing independent D3 simulations mapped by SVG ID to prevent memory leaks. */
const simulations = {};

/**
 * Main rendering function to draw the automaton graph on the SVG canvas.
 * 
 * @param {import('./state.js').Automaton} data - The automaton to render (defaults to global state).
 * @param {string} svgId - The ID of the target SVG element.
 * @param {string|null} containerId - The ID of the parent container for boundary calculations.
 * @returns {void} Mutates the DOM to render the D3 force graph.
 */
export function draw(data = automata, svgId = "svg", containerId = null) {
    if (!data) return;

    const svg = d3.select(`#${svgId}`);
    const svgNode = document.getElementById(svgId);
    if (!svgNode) return;

    // Determine the container to calculate dynamic width/height bounds
    let container;
    if (containerId) {
        container = document.getElementById(containerId);
    } else if (svgId === "svg") {
        container = document.getElementById("right-panel");
    } else {
        container = svgNode.parentElement;
    }

    const nodes = data.states.map(s => ({ id: s }));

    const bounds = calculateBounds(nodes);
    const width = Math.max(container.clientWidth || 400, bounds.width + 2 * radius);
    const height = Math.max(container.clientHeight || 300, bounds.height + 2 * radius);

    svg.attr("width", width).attr("height", height);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    // Prevent memory leaks and "ghost" forces by stopping any existing simulation on this SVG
    if (simulations[svgId]) {
        simulations[svgId].stop();
        delete simulations[svgId];
    }

    const defs = svg.append("defs");
    // Creates SVG markers for directional arrows on transition edges
    const createMarker = (id, color) => {
        defs.append("marker")
            .attr("id", `${id}-${svgId}`).attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5)
            .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto-start-reverse")
            .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", color);
    };
    createMarker("arrow", "black");
    createMarker("arrow-active", "#f39c12"); // Hardcoded hex ensures SVGs safely resolve the color

    // Edge Consolidation: If multiple symbols transition between the exact same two states,
    // combine them into a single edge with a comma-separated label to prevent visual clutter.
    const linkMap = {};
    for (const from in data.transitions) {
        for (const sym in data.transitions[from]) {
            const targets = Array.isArray(data.transitions[from][sym]) 
                            ? data.transitions[from][sym] 
                            : [data.transitions[from][sym]];
            targets.forEach(to => {
                const directionKey = `${from}->${to}`;
                if (!linkMap[directionKey]) {
                    linkMap[directionKey] = {
                        source: from,
                        target: to,
                        symbols: [],
                        edgeKeys: []
                    };
                }
                if (!linkMap[directionKey].symbols.includes(sym)) {
                    linkMap[directionKey].symbols.push(sym);
                    linkMap[directionKey].edgeKeys.push(`edge-${from}-${to}-${sym}`);
                }
            });
        }
    }

    const consolidatedLinks = Object.values(linkMap).map(l => ({
        ...l,
        label: l.symbols.join(", ")
    }));

    // Initialize the physics-based D3 Force Simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(consolidatedLinks).id(d => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", ticked);

    simulations[svgId] = simulation;

    const link = svg.append("g").selectAll("path")
        .data(consolidatedLinks).join("path")
        .attr("class", "edge")
        .attr("id", d => `path-${svgId}-${d.source.id || d.source}-${d.target.id || d.target}`)
        .attr("marker-end", `url(#arrow-${svgId})`);

    const linkLabels = svg.append("g").selectAll("text")
        .data(consolidatedLinks).join("text")
        .attr("class", "edge-label")
        .attr("text-anchor", "middle")
        .text(d => d.label);

    // --- Drag Interaction Handlers ---

    /**
     * Triggered when a node drag begins. Reheats the simulation.
     * @param {DragEvent} event - The D3 drag event.
     * @param {Object} d - The dragged node data.
     */
    const dragstarted = (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    // Dynamic Resizing Logic: As a node is dragged, compute bounding boxes.
    // If the node touches the edge of the SVG viewBox, expand the viewBox dynamically.
    /**
     * Triggered while a node is actively being dragged. Updates coordinates and triggers viewBox recalculation.
     * @param {DragEvent} event - The D3 drag event.
     * @param {Object} d - The dragged node data.
     */
    const dragged = (event, d) => {
        d.fx = event.x;
        d.fy = event.y;

        const svgWidth = +svg.attr("width");
        const svgHeight = +svg.attr("height");
        let viewBox = svg.attr("viewBox").split(" ").map(Number);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        simulation.nodes().forEach(node => {
            const x = node.id === d.id ? d.fx : (node.x || 0);
            const y = node.id === d.id ? d.fy : (node.y || 0);
            minX = Math.min(minX, x - radius);
            maxX = Math.max(maxX, x + radius);
            minY = Math.min(minY, y - radius);
            maxY = Math.max(maxY, y + radius);
        });

        const newVBox = [...viewBox];
        let updated = false;

        if (minX < newVBox[0]) {
            const diff = newVBox[0] - minX;
            newVBox[0] -= diff;
            newVBox[2] += diff;
            updated = true;
        }
        if (maxX > newVBox[0] + newVBox[2]) {
            newVBox[2] = maxX - newVBox[0];
            updated = true;
        }
        if (minY < newVBox[1]) {
            const diff = newVBox[1] - minY;
            newVBox[1] -= diff;
            newVBox[3] += diff;
            updated = true;
        }
        if (maxY > newVBox[1] + newVBox[3]) {
            newVBox[3] = maxY - newVBox[1];
            updated = true;
        }

        if (updated) {
            svg.attr("viewBox", newVBox.join(" "));
            const newWidth = Math.max(svgWidth, newVBox[2]);
            const newHeight = Math.max(svgHeight, newVBox[3]);
            
            if (newWidth > svgWidth || newHeight > svgHeight) {
                svg.attr("width", newWidth);
                svg.attr("height", newHeight);
            }

            const centerX = newVBox[0] + newVBox[2] / 2;
            const centerY = newVBox[1] + newVBox[3] / 2;
            simulation.force("center", d3.forceCenter(centerX, centerY));

            simulation.alpha(0.1).restart();
        }
    };

    /**
     * Triggered when a node drag operation completes. Cools the simulation.
     * @param {DragEvent} event - The D3 drag event.
     * @param {Object} d - The dragged node data.
     */
    const dragended = (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    // Node (State) Groups
    const node = svg.append("g").selectAll("g")
        .data(nodes).join("g")
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.append("circle").attr("class", "state").attr("id", d => `state-${svgId}-` + d.id).attr("r", radius);
    // Inner circle indicating an accepting (final) state
    node.filter(d => data.accept.includes(d.id)).append("circle").attr("class", "final-inner").attr("r", radius - 5);
    node.append("text").attr("text-anchor", "middle").attr("dy", 5).attr("class", "node-label").text(d => d.id);

    // Global Entry Arrow pointing to the Start State
    const startArrow = svg.append("path")
        .attr("id", `start-arrow-edge-${svgId}`)
        .attr("class", "edge")
        .attr("marker-end", `url(#arrow-${svgId})`);

    /**
     * Fired on every tick of the physics simulation.
     * Recalculates exact path geometries based on node coordinates.
     */
    function ticked() {
        link.attr("d", d => {
            const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
            // Case 1: Self-Loop (Draws a circle Arc above the state)
            if (d.source.id === d.target.id) {
                return `M ${sx} ${sy - radius} A ${loopOffset / 1.5} ${loopOffset} -45 1 1 ${sx + radius} ${sy}`;
            }
            
            // Case 2: Bidirectional Edge (Curves the path so opposite directions don't overlap)
            const hasReverse = consolidatedLinks.some(l => l.source.id === d.target.id && l.target.id === d.source.id);
            const dx = tx - sx, dy = ty - sy, dr = Math.sqrt(dx * dx + dy * dy);
            const ox = (dx / dr) * radius, oy = (dy / dr) * radius;

            if (hasReverse) {
                return `M ${sx + ox} ${sy + oy} A ${dr} ${dr} 0 0 1 ${tx - ox} ${ty - oy}`;
            }
            // Case 3: Standard straight line
            return `M ${sx + ox} ${sy + oy} L ${tx - ox} ${ty - oy}`;
        });

        linkLabels.attr("transform", d => {
            const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
            if (d.source.id === d.target.id) {
                return `translate(${sx + loopOffset}, ${sy - loopOffset})`;
            }

            const hasReverse = consolidatedLinks.some(l => l.source.id === d.target.id && l.target.id === d.source.id);
            const midX = (sx + tx) / 2;
            const midY = (sy + ty) / 2;

            if (hasReverse) {
                const dx = tx - sx;
                const dy = ty - sy;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = dy / len;
                const ny = -dx / len;
                const offset = 40;
                return `translate(${midX + nx * offset}, ${midY + ny * offset})`;
            }
            return `translate(${midX}, ${midY - 15})`;
        });

        node.attr("transform", d => `translate(${d.x},${d.y})`);
        const startNode = nodes.find(n => n.id === data.start);
        if (startNode) {
            startArrow.attr("d", `M ${startNode.x - radius - 60} ${startNode.y} L ${startNode.x - radius - 5} ${startNode.y}`);
        }
    }
}

/**
 * Calculates the absolute bounding box of all nodes.
 * Used to determine the initial canvas size required to fit the entire graph.
 * 
 * @param {Array} nodes - Array of D3 simulation node objects.
 * @returns {{width: number, height: number}} The rectangular bounds.
 */
function calculateBounds(nodes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        const x = n.x || 0;
        const y = n.y || 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    if (minX === Infinity) return { width: 0, height: 0 };
    return { width: maxX - minX, height: maxY - minY };
}

/**
 * Visually highlights specific states and transition edges.
 * This is triggered iteratively by the `runner-controller` during tape simulation.
 * 
 * @param {Set<string>} activeStates - Set of state IDs currently active.
 * @param {Set<string>} activeEdges - Set of edge mapping keys currently active.
 * @param {boolean} [isStart=false] - Whether this is the initial simulation step (highlights start arrow).
 * @returns {void} Mutates SVG classes.
 */
export function highlightStatesAndEdges(activeStates, activeEdges, isStart = false) {
    const svgId = "svg"; // Always apply running highlights to the main container
    const svg = d3.select(`#${svgId}`);
    
    // Scope selections safely to just this specific SVG!
    svg.selectAll(".state").classed("active", false);
    svg.selectAll(".edge").classed("active", false).attr("marker-end", `url(#arrow-${svgId})`);

    activeStates.forEach(id => svg.select(`#state-${svgId}-${id}`).classed("active", true));

    svg.selectAll(".edge").filter(d => {
        if (!d || !d.edgeKeys) return false;
        return d.edgeKeys.some(key => activeEdges.has(key));
    }).classed("active", true).attr("marker-end", `url(#arrow-active-${svgId})`);

    if (isStart) {
        svg.select(`#start-arrow-edge-${svgId}`).classed("active", true).attr("marker-end", `url(#arrow-active-${svgId})`);
    }
}
