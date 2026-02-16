/**
 * starmap.js - Main Three.js renderer (scene, camera, controls, bloom)
 * 
 * The StarmapRenderer class manages the complete 3D visualization:
 * - Scene setup with cosmic background
 * - Camera with orbit controls and smooth transitions
 * - UnrealBloomPass for glowing wireframe aesthetic
 * - Node, satellite, and path management
 * - Event system for user interaction
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { createNode, updateNodeState, animateNodeBreath, createNodeBirthAnimation, disposeNode, NODE_COLORS } from './nodes.js';
import { createSatellites, animateSatellites, disposeSatellites } from './satellites.js';
import { createPath, animatePathPulse, updatePathState, createPathDrawAnimation, disposePath, PATH_COLORS } from './paths.js';

// === Default Theme (merged from both art direction guides) ===
const DEFAULT_THEME = {
  // Node colors
  nodeColor: 0x00FFCC,
  nodeColorActive: 0x7DF4FF,
  nodeColorHover: 0x66FFEE,
  
  // Connection colors
  connectionColor: 0x00FFCC,
  connectionOpacity: 0.45,
  
  // Satellite colors
  satelliteColors: {
    length: 0x00AAFF,
    tools: 0x10B981,
    latency: 0xFF5A5A,
    drift: 0xAA44FF,
  },
  
  // Background
  backgroundColor: 0x040911,
};

// === Default Options ===
const DEFAULT_OPTIONS = {
  layout: 'path',
  nodeSpacing: 100,
  pathCurvature: 0.3,
  theme: DEFAULT_THEME,
  maxVisibleNodes: 200,
  enableGlow: true,
  
  // Camera
  cameraFov: 50,
  cameraNear: 1,
  cameraFar: 2000,
  cameraPosition: { x: 0, y: 150, z: 600 },
  
  // Bloom (from art direction)
  bloomStrength: 1.8,
  bloomRadius: 0.4,
  bloomThreshold: 0.6,
};

// === Layout Algorithms ===
const LAYOUT_ALGORITHMS = {
  /**
   * Path layout: nodes arranged along a forward path with slight variance.
   */
  path(nodes, spacing) {
    nodes.forEach((node, index) => {
      // Forward progression in Z with lateral variance
      const variance = Math.sin(index * 0.7) * spacing * 0.3;
      const yVariance = Math.cos(index * 0.5) * spacing * 0.2;

      node.position = {
        x: variance,
        y: yVariance,
        z: -index * spacing
      };
    });
  },

  /**
   * Cluster layout: nodes cluster based on similarity (placeholder).
   */
  cluster(nodes, spacing) {
    // For now, use a simple spiral
    nodes.forEach((node, index) => {
      const angle = index * 0.5;
      const radius = 50 + index * spacing * 0.15;

      node.position = {
        x: Math.cos(angle) * radius,
        y: Math.sin(index * 0.3) * spacing * 0.4,
        z: Math.sin(angle) * radius - index * spacing * 0.3
      };
    });
  },

  /**
   * Spiral layout: nodes arranged in a 3D spiral.
   */
  spiral(nodes, spacing) {
    nodes.forEach((node, index) => {
      const angle = index * 0.4;
      const radius = 100 + index * 8;
      const height = index * spacing * 0.3;

      node.position = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.5,
        z: -height
      };
    });
  },

  /**
   * Shape-driven layout: session shape descriptors control the visual form.
   *
   * A focused session (high linearity, high density) produces a tight,
   * nearly-straight bead chain. A scattered session (low linearity,
   * high breadth) sprawls outward like a neural map.
   *
   * The shape IS the insight — you glance at it and know.
   *
   * @param {Array} nodes - PromptNode array
   * @param {number} spacing - Base spacing
   * @param {import('../data/session-shape.js').SessionShape} [shape] - Session shape data
   */
  shape(nodes, spacing, shape) {
    if (!shape || nodes.length === 0) {
      // Fall back to path layout if no shape data
      LAYOUT_ALGORITHMS.path(nodes, spacing);
      return;
    }

    const { linearity, density, breadth, convergence } = shape;

    // --- Compute layout parameters from shape ---

    // Lateral spread: low linearity = wide meander, high = tight line
    // Range: 0.05 (laser straight) to 0.8 (wild swings)
    const lateralFactor = 0.05 + (1 - linearity) * 0.75;

    // Y spread: breadth drives vertical variance (more topics = more Y range)
    const yFactor = 0.05 + breadth * 0.5;

    // Spacing consistency: high density = uniform spacing, low = varied
    const spacingVariance = (1 - density) * 0.5;

    // Direction change frequency: low linearity = frequent turns
    const turnFrequency = 0.3 + (1 - linearity) * 0.8;

    // Convergence affects whether the path tightens or loosens over time
    // Positive convergence = funnel inward, negative = expand outward
    const convergenceRate = convergence * 0.3;

    // --- Lay out nodes ---
    nodes.forEach((node, index) => {
      const t = nodes.length > 1 ? index / (nodes.length - 1) : 0; // 0..1 progress

      // Per-node drift drives individual displacement
      const drift = node.metrics?.topicDriftScore ?? 0;
      const complexity = (node.metrics?.complexityScore ?? 50) / 100;

      // Convergence modulates spread over time
      // At t=0, full spread. At t=1, spread * (1 - convergenceRate)
      const spreadModifier = 1 - convergenceRate * t;

      // Base forward progression
      const baseSpacing = spacing * (1 + (Math.random() - 0.5) * spacingVariance * 2);

      // Lateral displacement driven by drift + a gentle sine wave for organic feel
      const lateralDisplacement = (
        Math.sin(index * turnFrequency) * spacing * lateralFactor +
        drift * spacing * lateralFactor * 1.5
      ) * spreadModifier;

      // Y displacement driven by complexity + breadth factor
      const yDisplacement = (
        Math.cos(index * turnFrequency * 0.7) * spacing * yFactor +
        (complexity - 0.5) * spacing * yFactor
      ) * spreadModifier;

      node.position = {
        x: lateralDisplacement,
        y: yDisplacement,
        z: -index * baseSpacing
      };
    });
  },
};

/**
 * StarmapRenderer - Main visualization class.
 */
export class StarmapRenderer {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.theme = { ...DEFAULT_THEME, ...options.theme };
    
    // State
    this.nodes = [];
    this.currentIndex = 0;
    this.hoveredIndex = null;
    
    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.controls = null;
    
    // Content groups
    this.nodesGroup = null;
    this.pathsGroup = null;
    this.starsGroup = null;
    
    // Internal tracking
    this.nodeObjects = new Map();   // id -> { group, satellites }
    this.pathObjects = new Map();   // "fromId-toId" -> pathGroup
    this.animations = [];           // Active animations
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Animation frame
    this.animationFrameId = null;
    this.lastTime = 0;
    
    // Raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Camera transition state
    this.cameraTransition = null;
    
    // Container reference
    this.container = null;
    this.isEmbedded = false;
  }
  
  // === Lifecycle ===
  
  /**
   * Mount the renderer in standalone mode.
   * @param {HTMLElement} container - DOM container for the canvas
   */
  mount(container) {
    this.container = container;
    this.isEmbedded = false;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.backgroundColor);
    
    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.options.cameraFov,
      aspect,
      this.options.cameraNear,
      this.options.cameraFar
    );
    const pos = this.options.cameraPosition;
    this.camera.position.set(pos.x, pos.y, pos.z);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    container.appendChild(this.renderer.domElement);
    
    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.8;
    this.controls.enableRotate = true;
    this.controls.rotateSpeed = 0.4;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 1500;
    this.controls.minPolarAngle = Math.PI * 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    
    // Create post-processing
    if (this.options.enableGlow) {
      this.setupBloom();
    }
    
    // Create content groups
    this.setupContentGroups();
    
    // Create background elements
    this.createBackground();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start animation loop
    this.startAnimationLoop();
    
    // Emit ready event
    setTimeout(() => this.emit('ready'), 0);
  }
  
  /**
   * Embed the renderer into an existing Three.js scene.
   * @param {THREE.Scene} scene - Existing scene
   * @returns {THREE.Group} - Group to add to the scene
   */
  embed(scene) {
    this.scene = scene;
    this.isEmbedded = true;
    
    // Create a group to hold all our content
    const embedGroup = new THREE.Group();
    embedGroup.name = 'StarmapEmbed';
    
    // Create content groups attached to embed group
    this.nodesGroup = new THREE.Group();
    this.nodesGroup.name = 'Nodes';
    embedGroup.add(this.nodesGroup);
    
    this.pathsGroup = new THREE.Group();
    this.pathsGroup.name = 'Paths';
    embedGroup.add(this.pathsGroup);
    
    scene.add(embedGroup);
    
    // Emit ready event
    setTimeout(() => this.emit('ready'), 0);
    
    return embedGroup;
  }
  
  /**
   * Clean up all resources.
   */
  dispose() {
    // Stop animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Dispose all node objects
    this.nodeObjects.forEach(({ group, satellites }) => {
      disposeNode(group);
      if (satellites) disposeSatellites(satellites);
    });
    this.nodeObjects.clear();
    
    // Dispose all path objects
    this.pathObjects.forEach((pathGroup) => {
      disposePath(pathGroup);
    });
    this.pathObjects.clear();
    
    // Dispose background
    if (this.starsGroup) {
      this.starsGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Dispose composer
    if (this.composer) {
      this.composer.dispose();
    }
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement.parentNode) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    
    // Clear controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
    
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize);
  }
  
  // === Setup Methods ===
  
  setupBloom() {
    this.composer = new EffectComposer(this.renderer);
    
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      this.options.bloomStrength,
      this.options.bloomRadius,
      this.options.bloomThreshold
    );
    this.composer.addPass(bloomPass);
    
    this.bloomPass = bloomPass;
  }
  
  setupContentGroups() {
    this.nodesGroup = new THREE.Group();
    this.nodesGroup.name = 'Nodes';
    this.scene.add(this.nodesGroup);
    
    this.pathsGroup = new THREE.Group();
    this.pathsGroup.name = 'Paths';
    this.scene.add(this.pathsGroup);
    
    this.starsGroup = new THREE.Group();
    this.starsGroup.name = 'Background';
    this.scene.add(this.starsGroup);
  }
  
  setupEventListeners() {
    // Resize handler
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    
    // Mouse/pointer events
    if (this.renderer) {
      this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove.bind(this));
      this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
    }
  }
  
  createBackground() {
    // Create subtle starfield
    const starCount = 500;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Spread stars in a large sphere
      const radius = 800 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      sizes[i] = 0.5 + Math.random() * 1.5;
    }
    
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
      color: 0x7DDFFF,
      size: 1,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.starsGroup.add(stars);
    
    // Add subtle grid plane (optional)
    const gridHelper = new THREE.GridHelper(2000, 50, 0x1a1a2e, 0x0a0a1a);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.15;
    gridHelper.position.y = -200;
    this.starsGroup.add(gridHelper);
  }
  
  // === Event Handlers ===
  
  handleResize() {
    if (!this.container || this.isEmbedded) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }
  
  handlePointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast to find hovered node
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(this.nodesGroup.children, true);
    
    let newHoveredIndex = null;
    
    if (intersects.length > 0) {
      // Find the node group parent
      let obj = intersects[0].object;
      while (obj.parent && obj.userData.type !== 'promptNode') {
        obj = obj.parent;
      }
      
      if (obj.userData.type === 'promptNode') {
        newHoveredIndex = obj.userData.nodeIndex;
      }
    }
    
    if (newHoveredIndex !== this.hoveredIndex) {
      // Leave event for previous
      if (this.hoveredIndex !== null) {
        const prevNode = this.nodes[this.hoveredIndex];
        if (prevNode) {
          this.emit('node:leave', { node: prevNode, index: this.hoveredIndex });
          this.updateNodeVisualState(this.hoveredIndex);
        }
      }
      
      this.hoveredIndex = newHoveredIndex;
      
      // Hover event for new
      if (this.hoveredIndex !== null) {
        const node = this.nodes[this.hoveredIndex];
        if (node) {
          this.emit('node:hover', {
            node,
            index: this.hoveredIndex,
            screenPosition: { x: event.clientX, y: event.clientY }
          });
          this.updateNodeVisualState(this.hoveredIndex);
        }
      }
    }
  }
  
  handleClick(event) {
    if (this.hoveredIndex !== null) {
      const node = this.nodes[this.hoveredIndex];
      if (node) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.emit('node:click', {
          node,
          index: this.hoveredIndex,
          screenPosition: { x: event.clientX, y: event.clientY }
        });
        
        // Also focus on the clicked node
        this.focusNode(this.hoveredIndex);
      }
    }
  }
  
  // === Data Methods ===
  
  /**
   * Set the complete node array.
   * @param {PromptNode[]} nodes - Array of prompt nodes
   * @param {import('../data/session-shape.js').SessionShape} [shape] - Session shape for layout
   */
  setNodes(nodes, shape) {
    // Clear existing
    this.clearAllObjects();

    this.nodes = nodes;
    this.sessionShape = shape || null;

    // Use shape-driven layout if shape data is available, otherwise fall back to configured layout
    const layoutKey = shape ? 'shape' : this.options.layout;
    const layoutFn = LAYOUT_ALGORITHMS[layoutKey] || LAYOUT_ALGORITHMS.path;

    if (layoutKey === 'shape') {
      layoutFn(this.nodes, this.options.nodeSpacing, shape);
    } else {
      layoutFn(this.nodes, this.options.nodeSpacing);
    }
    
    // Create visual objects for each node
    this.nodes.forEach((node, index) => {
      this.createNodeObjects(node, index);
    });
    
    // Create paths between adjacent nodes
    for (let i = 1; i < this.nodes.length; i++) {
      this.createPathBetween(i - 1, i);
    }
    
    // Focus on first node if any
    if (this.nodes.length > 0) {
      this.currentIndex = 0;
      this.updateAllVisualStates();
      this.focusNode(0, false); // No animation for initial
    }
  }
  
  /**
   * Update a single node's data.
   * @param {string} id - Node ID
   * @param {Partial<PromptNode>} partial - Partial update
   */
  updateNode(id, partial) {
    const index = this.nodes.findIndex(n => n.id === id);
    if (index === -1) return;
    
    this.nodes[index] = { ...this.nodes[index], ...partial };
    
    // Rebuild visual if metrics changed
    if (partial.metrics) {
      const nodeObj = this.nodeObjects.get(id);
      if (nodeObj) {
        // Dispose and recreate
        disposeNode(nodeObj.group);
        if (nodeObj.satellites) disposeSatellites(nodeObj.satellites);
        this.nodesGroup.remove(nodeObj.group);
        
        this.createNodeObjects(this.nodes[index], index);
      }
    }
  }
  
  // === Navigation ===
  
  /**
   * Focus camera on a specific node.
   * @param {number} index - Node index
   * @param {boolean} animate - Whether to animate the transition
   */
  focusNode(index, animate = true) {
    if (index < 0 || index >= this.nodes.length) return;
    
    const prevIndex = this.currentIndex;
    this.currentIndex = index;
    
    const node = this.nodes[index];
    const nodeObj = this.nodeObjects.get(node.id);
    
    if (!nodeObj) return;
    
    const targetPosition = new THREE.Vector3(
      node.position.x,
      node.position.y,
      node.position.z
    );
    
    // Calculate camera target position (offset to view node)
    const cameraOffset = new THREE.Vector3(80, 60, 200);
    const cameraTarget = targetPosition.clone().add(cameraOffset);
    
    if (animate && this.controls) {
      // Smooth camera transition
      this.cameraTransition = {
        startPosition: this.camera.position.clone(),
        endPosition: cameraTarget,
        startTarget: this.controls.target.clone(),
        endTarget: targetPosition,
        startTime: performance.now(),
        duration: 800,
      };
    } else if (this.controls) {
      this.camera.position.copy(cameraTarget);
      this.controls.target.copy(targetPosition);
      this.controls.update();
    }
    
    // Update visual states
    this.updateAllVisualStates();
    
    // Emit focus change event
    this.emit('focus:change', {
      node,
      index,
      previousIndex: prevIndex
    });
  }
  
  /**
   * Get the node at a screen position.
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @returns {PromptNode | null}
   */
  getNodeAtPoint(screenX, screenY) {
    if (!this.renderer) return null;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.nodesGroup.children, true);
    
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && obj.userData.type !== 'promptNode') {
        obj = obj.parent;
      }
      
      if (obj.userData.type === 'promptNode') {
        return this.nodes[obj.userData.nodeIndex] || null;
      }
    }
    
    return null;
  }
  
  // === Appearance ===
  
  /**
   * Update the color theme.
   * @param {StarmapTheme} theme - New theme
   */
  setTheme(theme) {
    this.theme = { ...this.theme, ...theme };
    
    // Update background
    if (this.scene && theme.backgroundColor !== undefined) {
      this.scene.background = new THREE.Color(theme.backgroundColor);
    }
    
    // Re-render all nodes with new colors
    this.updateAllVisualStates();
  }
  
  /**
   * Set visibility of different elements.
   * @param {VisibilityOptions} options
   */
  setVisibility({ connections = true, satellites: showSatellites = true, labels = true, grid = true } = {}) {
    if (this.pathsGroup) {
      this.pathsGroup.visible = connections;
    }
    
    // Toggle satellites on each node
    this.nodeObjects.forEach(({ satellites }) => {
      if (satellites) {
        satellites.visible = showSatellites;
      }
    });
    
    // Toggle grid
    if (this.starsGroup) {
      this.starsGroup.children.forEach((child) => {
        if (child instanceof THREE.GridHelper) {
          child.visible = grid;
        }
      });
    }
  }
  
  // === Events ===
  
  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }
  
  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Emit an event.
   * @param {string} event - Event name
   * @param {any} payload - Event data
   */
  emit(event, payload) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
  }
  
  // === Internal Methods ===
  
  clearAllObjects() {
    // Dispose and remove all node objects
    this.nodeObjects.forEach(({ group, satellites }) => {
      disposeNode(group);
      if (satellites) disposeSatellites(satellites);
      this.nodesGroup.remove(group);
    });
    this.nodeObjects.clear();
    
    // Dispose and remove all path objects
    this.pathObjects.forEach((pathGroup) => {
      disposePath(pathGroup);
      this.pathsGroup.remove(pathGroup);
    });
    this.pathObjects.clear();
    
    // Clear animations
    this.animations = [];
  }
  
  createNodeObjects(node, index) {
    // Create node geometry
    const complexity = node.metrics?.complexityScore || 50;
    const tokenCount = node.metrics?.tokenEstimate || 100;
    const isActive = index === this.currentIndex;
    const isHistorical = index < this.currentIndex;
    
    const nodeGroup = createNode({
      complexity,
      tokenCount,
      isActive,
      isHistorical,
    });
    
    // Store node data on the group
    nodeGroup.userData.nodeIndex = index;
    nodeGroup.userData.nodeId = node.id;
    
    // Position the node
    nodeGroup.position.set(
      node.position.x,
      node.position.y,
      node.position.z
    );
    
    this.nodesGroup.add(nodeGroup);
    
    // Create satellites if metrics available
    let satelliteGroup = null;
    if (node.metrics) {
      satelliteGroup = createSatellites(node.metrics);
      nodeGroup.add(satelliteGroup);
    }
    
    // Store reference
    this.nodeObjects.set(node.id, {
      group: nodeGroup,
      satellites: satelliteGroup,
    });
    
    // Create birth animation for new nodes
    if (this.nodes.length > 1 && index === this.nodes.length - 1) {
      const animation = createNodeBirthAnimation(nodeGroup);
      this.animations.push(animation);
    }
  }
  
  createPathBetween(fromIndex, toIndex) {
    const fromNode = this.nodes[fromIndex];
    const toNode = this.nodes[toIndex];
    
    if (!fromNode || !toNode) return;
    
    const startPos = new THREE.Vector3(
      fromNode.position.x,
      fromNode.position.y,
      fromNode.position.z
    );
    
    const endPos = new THREE.Vector3(
      toNode.position.x,
      toNode.position.y,
      toNode.position.z
    );
    
    const isActive = fromIndex === this.currentIndex - 1 || toIndex === this.currentIndex;
    const age = Math.abs(this.currentIndex - toIndex);
    
    const pathGroup = createPath(startPos, endPos, {
      isActive,
      age,
      curveType: 'subway',
    });
    
    this.pathsGroup.add(pathGroup);
    this.pathObjects.set(`${fromNode.id}-${toNode.id}`, pathGroup);
    
    // Animate path drawing for new paths
    if (toIndex === this.nodes.length - 1 && this.nodes.length > 1) {
      const animation = createPathDrawAnimation(pathGroup);
      this.animations.push(animation);
    }
  }
  
  updateNodeVisualState(index) {
    const node = this.nodes[index];
    if (!node) return;
    
    const nodeObj = this.nodeObjects.get(node.id);
    if (!nodeObj) return;
    
    const isActive = index === this.currentIndex;
    const isHovered = index === this.hoveredIndex;
    const isHistorical = index < this.currentIndex;
    
    updateNodeState(nodeObj.group, { isActive, isHovered, isHistorical });
  }
  
  updateAllVisualStates() {
    // Update all nodes
    this.nodes.forEach((node, index) => {
      this.updateNodeVisualState(index);
    });
    
    // Update all paths
    this.pathObjects.forEach((pathGroup, key) => {
      const [fromId, toId] = key.split('-');
      const fromIndex = this.nodes.findIndex(n => n.id === fromId);
      const toIndex = this.nodes.findIndex(n => n.id === toId);
      
      const isActive = toIndex === this.currentIndex || fromIndex === this.currentIndex;
      const age = Math.abs(this.currentIndex - Math.max(fromIndex, toIndex));
      
      updatePathState(pathGroup, { isActive, age });
    });
  }
  
  updateCameraTransition(currentTime) {
    if (!this.cameraTransition) return;
    
    const { startPosition, endPosition, startTarget, endTarget, startTime, duration } = this.cameraTransition;
    
    const elapsed = currentTime - startTime;
    let t = Math.min(elapsed / duration, 1);
    
    // Ease in-out cubic
    t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    // Interpolate position
    this.camera.position.lerpVectors(startPosition, endPosition, t);
    
    // Interpolate target
    if (this.controls) {
      this.controls.target.lerpVectors(startTarget, endTarget, t);
      this.controls.update();
    }
    
    if (elapsed >= duration) {
      this.cameraTransition = null;
    }
  }
  
  startAnimationLoop() {
    const animate = (time) => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      const deltaTime = (time - this.lastTime) / 1000;
      this.lastTime = time;
      
      // Update camera transition
      this.updateCameraTransition(time);
      
      // Update orbit controls
      if (this.controls) {
        this.controls.update();
      }
      
      // Update animations
      this.animations = this.animations.filter((anim) => {
        anim.update(time);
        return !anim.isComplete;
      });
      
      // Animate nodes
      this.nodeObjects.forEach(({ group, satellites }) => {
        // Breath animation for active node
        if (group.userData.isActive) {
          animateNodeBreath(group, time);
        }
        
        // Satellite orbits
        if (satellites) {
          animateSatellites(satellites, deltaTime, time);
        }
      });
      
      // Animate path pulses
      this.pathObjects.forEach((pathGroup) => {
        animatePathPulse(pathGroup, time);
      });
      
      // Render
      if (this.composer) {
        this.composer.render();
      } else if (this.renderer) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    
    animate(0);
  }
}

export default StarmapRenderer;
