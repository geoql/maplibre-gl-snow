import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MaplibreMap,
} from 'maplibre-gl';
import snowVertexShader from './shaders/snow.vert.glsl';
import snowFragmentShader from './shaders/snow.frag.glsl';
import fogVertexShader from './shaders/fog.vert.glsl';
import fogFragmentShader from './shaders/fog.frag.glsl';

type MaplibreSnowLayerOptions = {
  /** Unique layer ID (default: 'snow') */
  id?: string;
  /** Particle density 0–1 scale. Controls total particle count. (default: 0.5) */
  density?: number;
  /** Fall speed intensity 0–1. (default: 0.5) */
  intensity?: number;
  /** Base flake size multiplier (default: 4) */
  flakeSize?: number;
  /** Flake color as [r, g, b] in 0–1 range (default: [1, 1, 1]) */
  color?: [number, number, number];
  /**
   * Wind as [horizontal, vertical] speed at bearing=0 (north-up).
   * Automatically rotated by map bearing, so wind direction is world-relative.
   * (default: [0, 0])
   */
  direction?: [number, number];
  /** Global opacity multiplier 0–1 (default: 0.8) */
  opacity?: number;
  /** Enable atmospheric fog overlay (default: true) */
  fog?: boolean;
  /** Fog tint color as [r, g, b] 0–1 (default: [0.18, 0.20, 0.28]) */
  fogColor?: [number, number, number];
  /** Fog opacity 0–1 (default: 0.08) */
  fogOpacity?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum particles at density = 1.0 */
const MAX_PARTICLES = 15000;

/** Floats per particle: offsetX, offsetY, speed, size, opacity, phase, altitude */
const FLOATS_PER_PARTICLE = 7;

/** Stride in bytes = 7 floats × 4 bytes */
const STRIDE = FLOATS_PER_PARTICLE * 4;

// ---------------------------------------------------------------------------
// Attribute metadata
// ---------------------------------------------------------------------------

type AttribMeta = {
  readonly name: string;
  readonly size: number;
  readonly offset: number;
};

const ATTRIBS: readonly AttribMeta[] = [
  { name: 'a_offset', size: 2, offset: 0 },
  { name: 'a_speed', size: 1, offset: 8 },
  { name: 'a_size', size: 1, offset: 12 },
  { name: 'a_opacity', size: 1, offset: 16 },
  { name: 'a_phase', size: 1, offset: 20 },
  { name: 'a_altitude', size: 1, offset: 24 },
] as const;

// ---------------------------------------------------------------------------
// Uniform names
// ---------------------------------------------------------------------------

const UNIFORM_NAMES = [
  'u_time',
  'u_intensity',
  'u_direction',
  'u_bearing',
  'u_flakeSize',
  'u_color',
  'u_opacity',
  'u_screenHeight',
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

const FOG_UNIFORM_NAMES = [
  'u_resolution',
  'u_fogOpacity',
  'u_fogColor',
] as const;

type FogUniformName = (typeof FOG_UNIFORM_NAMES)[number];

// ---------------------------------------------------------------------------
// GL type alias — WebGL1 or WebGL2
// ---------------------------------------------------------------------------

type GL = WebGLRenderingContext | WebGL2RenderingContext;

// ---------------------------------------------------------------------------
// Layer class
// ---------------------------------------------------------------------------

class MaplibreSnowLayer implements CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom' as const;
  renderingMode: '3d' = '3d' as const;

  // Snow options
  private _density: number;
  private _intensity: number;
  private _flakeSize: number;
  private _color: [number, number, number];
  private _direction: [number, number];
  private _opacity: number;

  // Fog options
  private _fog: boolean;
  private _fogColor: [number, number, number];
  private _fogOpacity: number;

  // Snow GL resources
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private particleCount: number = 0;
  private startTime: number = 0;
  private map: MaplibreMap | null = null;
  private gl: GL | null = null;

  // Snow cached locations
  private attribLocations: number[] = [];
  private uniforms: Record<UniformName, WebGLUniformLocation | null> =
    {} as Record<UniformName, WebGLUniformLocation | null>;

  // Fog GL resources
  private fogProgram: WebGLProgram | null = null;
  private fogBuffer: WebGLBuffer | null = null;
  private fogAttribLoc: number = -1;
  private fogUniforms: Record<FogUniformName, WebGLUniformLocation | null> =
    {} as Record<FogUniformName, WebGLUniformLocation | null>;

  constructor(options: MaplibreSnowLayerOptions = {}) {
    this.id = options.id ?? 'snow';
    this._density = options.density ?? 0.5;
    this._intensity = options.intensity ?? 0.5;
    this._flakeSize = options.flakeSize ?? 4;
    this._color = options.color ?? [1, 1, 1];
    this._direction = options.direction ?? [0, 0];
    this._opacity = options.opacity ?? 0.8;
    this._fog = options.fog ?? true;
    this._fogColor = options.fogColor ?? [0.18, 0.2, 0.28];
    this._fogOpacity = options.fogOpacity ?? 0.08;
  }

  // -----------------------------------------------------------------------
  // Public API — dynamic updates
  // -----------------------------------------------------------------------

  setDensity(density: number): void {
    this._density = density;
    if (this.gl) {
      this.buildParticleBuffer(this.gl);
    }
    this.map?.triggerRepaint();
  }

  setIntensity(intensity: number): void {
    this._intensity = intensity;
    this.map?.triggerRepaint();
  }

  setFlakeSize(size: number): void {
    this._flakeSize = size;
    this.map?.triggerRepaint();
  }

  setColor(color: [number, number, number]): void {
    this._color = color;
    this.map?.triggerRepaint();
  }

  setDirection(direction: [number, number]): void {
    this._direction = direction;
    this.map?.triggerRepaint();
  }

  setOpacity(opacity: number): void {
    this._opacity = opacity;
    this.map?.triggerRepaint();
  }

  setFog(enabled: boolean): void {
    this._fog = enabled;
    this.map?.triggerRepaint();
  }

  setFogColor(color: [number, number, number]): void {
    this._fogColor = color;
    this.map?.triggerRepaint();
  }

  setFogOpacity(opacity: number): void {
    this._fogOpacity = opacity;
    this.map?.triggerRepaint();
  }

  // -----------------------------------------------------------------------
  // CustomLayerInterface
  // -----------------------------------------------------------------------

  onAdd(map: MaplibreMap, gl: GL): void {
    this.map = map;
    this.gl = gl;
    this.startTime = performance.now();

    // -- Snow program --
    this.program = this.buildProgram(gl, snowVertexShader, snowFragmentShader);

    this.attribLocations = ATTRIBS.map((a) =>
      gl.getAttribLocation(this.program!, a.name),
    );

    for (const name of UNIFORM_NAMES) {
      this.uniforms[name] = gl.getUniformLocation(this.program!, name);
    }

    // -- Fog program --
    this.fogProgram = this.buildProgram(gl, fogVertexShader, fogFragmentShader);

    this.fogAttribLoc = gl.getAttribLocation(this.fogProgram, 'a_pos');

    for (const name of FOG_UNIFORM_NAMES) {
      this.fogUniforms[name] = gl.getUniformLocation(this.fogProgram, name);
    }

    // Fullscreen quad (triangle strip)
    this.fogBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fogBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    // Build initial particle data
    this.buildParticleBuffer(gl);
  }

  render(gl: GL, _args: CustomRenderMethodInput): void {
    if (!this.program || !this.buffer || this.particleCount === 0 || !this.map)
      return;

    // Elapsed time in seconds
    const elapsed = (performance.now() - this.startTime) / 1000.0;

    // Map bearing in radians — used to rotate wind direction so it stays
    // world-relative as the user rotates the map
    const bearingRad = (this.map.getBearing() * Math.PI) / 180;

    // --- Save GL state ---
    const prevProgram = gl.getParameter(
      gl.CURRENT_PROGRAM,
    ) as WebGLProgram | null;
    const prevBuffer = gl.getParameter(
      gl.ARRAY_BUFFER_BINDING,
    ) as WebGLBuffer | null;
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;
    const prevDepthTest = gl.isEnabled(gl.DEPTH_TEST);

    // Premultiplied alpha blend (MapLibre renderingMode: '3d' expects this)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // --- Draw atmospheric fog (fullscreen overlay, no depth test) ---
    if (this._fog && this.fogProgram && this.fogBuffer) {
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      gl.useProgram(this.fogProgram);

      gl.uniform2f(
        this.fogUniforms.u_resolution,
        gl.canvas.width,
        gl.canvas.height,
      );
      gl.uniform1f(this.fogUniforms.u_fogOpacity, this._fogOpacity);
      gl.uniform3f(
        this.fogUniforms.u_fogColor,
        this._fogColor[0],
        this._fogColor[1],
        this._fogColor[2],
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, this.fogBuffer);
      if (this.fogAttribLoc >= 0) {
        gl.enableVertexAttribArray(this.fogAttribLoc);
        gl.vertexAttribPointer(this.fogAttribLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disableVertexAttribArray(this.fogAttribLoc);
      }
    }

    // --- Draw snow particles (screen-space NDC — no depth test needed) ---
    // Depth test is disabled: snow is a weather overlay, always visible.
    // Depth write is off: transparent particles don't occlude each other.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);

    gl.useProgram(this.program);

    // Animation + camera uniforms
    gl.uniform1f(this.uniforms.u_time, elapsed);
    gl.uniform1f(this.uniforms.u_intensity, this._intensity);
    gl.uniform2f(
      this.uniforms.u_direction,
      this._direction[0],
      this._direction[1],
    );
    // Bearing rotates the wind vector in the shader so wind is world-relative
    gl.uniform1f(this.uniforms.u_bearing, bearingRad);
    gl.uniform1f(this.uniforms.u_flakeSize, this._flakeSize);
    gl.uniform1f(this.uniforms.u_screenHeight, gl.canvas.height);
    gl.uniform3f(
      this.uniforms.u_color,
      this._color[0],
      this._color[1],
      this._color[2],
    );
    gl.uniform1f(this.uniforms.u_opacity, this._opacity);

    // Bind particle buffer and set up attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    for (let i = 0; i < ATTRIBS.length; i++) {
      const loc = this.attribLocations[i];
      if (loc === undefined || loc < 0) continue;
      const meta = ATTRIBS[i];
      if (!meta) continue;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        meta.size,
        gl.FLOAT,
        false,
        STRIDE,
        meta.offset,
      );
    }

    gl.drawArrays(gl.POINTS, 0, this.particleCount);

    // --- Restore GL state ---
    for (let i = 0; i < ATTRIBS.length; i++) {
      const loc = this.attribLocations[i];
      if (loc === undefined || loc < 0) continue;
      gl.disableVertexAttribArray(loc);
    }

    gl.depthMask(prevDepthMask);
    if (prevDepthTest) {
      gl.enable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, prevBuffer);
    gl.useProgram(prevProgram);

    // Request next frame
    this.map?.triggerRepaint();
  }

  onRemove(_map: MaplibreMap, gl: GL): void {
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.fogProgram) gl.deleteProgram(this.fogProgram);
    if (this.fogBuffer) gl.deleteBuffer(this.fogBuffer);
    this.program = null;
    this.buffer = null;
    this.fogProgram = null;
    this.fogBuffer = null;
    this.gl = null;
    this.map = null;
    this.attribLocations = [];
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private buildParticleBuffer(gl: GL): void {
    this.particleCount = Math.round(
      Math.max(0, Math.min(1, this._density)) * MAX_PARTICLES,
    );

    if (this.particleCount === 0) return;

    const data = new Float32Array(this.particleCount * FLOATS_PER_PARTICLE);
    const TWO_PI = Math.PI * 2;

    for (let i = 0; i < this.particleCount; i++) {
      const offset = i * FLOATS_PER_PARTICLE;
      const layerRand = Math.random();

      let sizeBase: number;
      let opacityBase: number;

      if (layerRand < 0.55) {
        // Background layer: tiny, faint
        sizeBase = 0.4 + Math.random() * 0.4;
        opacityBase = 0.15 + Math.random() * 0.2;
      } else if (layerRand < 0.88) {
        // Mid layer
        sizeBase = 0.7 + Math.random() * 0.6;
        opacityBase = 0.25 + Math.random() * 0.3;
      } else {
        // Foreground layer: large, bright
        sizeBase = 1.0 + Math.random() * 1.5;
        opacityBase = 0.4 + Math.random() * 0.4;
      }

      data[offset] = Math.random() * 2 - 1; // offsetX: initial screen X in [-1, 1]
      data[offset + 1] = Math.random() * 2 - 1; // offsetY: unused by shader (kept for stride compat)
      data[offset + 2] = 0.3 + Math.random() * 0.4; // speed
      data[offset + 3] = sizeBase; // size (layer-dependent)
      data[offset + 4] = opacityBase; // opacity (layer-dependent)
      data[offset + 5] = Math.random() * TWO_PI; // phase (also determines depth layer via golden ratio)
      data[offset + 6] = Math.random(); // altitude: initial Y position [0, 1]
    }

    if (this.buffer) {
      gl.deleteBuffer(this.buffer);
    }
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  private buildProgram(
    gl: GL,
    vertSource: string,
    fragSource: string,
  ): WebGLProgram {
    const vert = this.compileShader(gl, gl.VERTEX_SHADER, vertSource);
    const frag = this.compileShader(gl, gl.FRAGMENT_SHADER, fragSource);

    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create WebGL program');
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      throw new Error(`Program link error: ${info ?? 'unknown'}`);
    }

    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return program;
  }

  private compileShader(gl: GL, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info ?? 'unknown'}`);
    }
    return shader;
  }
}

export type { MaplibreSnowLayerOptions };
export { MaplibreSnowLayer };
