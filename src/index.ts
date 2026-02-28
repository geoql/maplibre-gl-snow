/**
 * @geoql/maplibre-gl-snow
 *
 * WebGPU-accelerated snow particle layer for MapLibre GL JS.
 * Uses Three.js WebGPU renderer with TSL compute shaders.
 *
 * Architecture:
 * - Two-canvas overlay: MapLibre (WebGL2) + Three.js WebGPU overlay
 * - Particles georeferenced as (mercX, mercY, altMerc) in mercator [0,1] space
 * - Camera syncs to MapLibre's mercator projection matrix directly
 * - MapLibre drives the frame loop via triggerRepaint()
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  vec3,
  vec4,
  float,
  uint,
  dot,
  instanceIndex,
  instancedArray,
  positionLocal,
  uniform,
  hash,
  If,
  color,
  screenUV,
  smoothstep,
  uv,
} from 'three/tsl';
import type { CustomRenderMethodInput, Map as MaplibreMap } from 'maplibre-gl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaplibreSnowOptions {
  /** Unique layer ID (default: 'snow') */
  id?: string;
  /** Particle density 0–1 (default: 0.5) */
  density?: number;
  /** Fall speed intensity 0–1 (default: 0.5) */
  intensity?: number;
  /** Base flake size in CSS pixels (default: 4) */
  flakeSize?: number;
  /** Global opacity 0–1 (default: 0.8) */
  opacity?: number;
  /** Wind as [azimuth degrees, horizontal speed px/s] (default: [0, 50]) */
  direction?: [number, number];
  /** Enable atmospheric fog overlay (default: true) */
  fog?: boolean;
  /** Fog opacity 0–1 (default: 0.08) */
  fogOpacity?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PARTICLE_COUNT = 8_000;
const MIN_PARTICLE_COUNT = 2_000;
const MAX_PARTICLE_COUNT = 20_000;

// ---------------------------------------------------------------------------
// Mercator helpers (no maplibre-gl import needed)
// ---------------------------------------------------------------------------

function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI),
  };
}

// ---------------------------------------------------------------------------
// WebGPU Particle System
// ---------------------------------------------------------------------------

class SnowGPU {
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  // Particle state
  private particleCount = DEFAULT_PARTICLE_COUNT;
  private posBuffer: ReturnType<typeof instancedArray> | null = null;
  private velBuffer: ReturnType<typeof instancedArray> | null = null;
  private snowMesh: THREE.Mesh | null = null;
  private computeInit: ReturnType<ReturnType<typeof Fn>['compute']> | null =
    null;
  private computeUpdate: ReturnType<ReturnType<typeof Fn>['compute']> | null =
    null;

  // Uniforms (updated every frame from render callback)
  private uCenter = uniform(new THREE.Vector2(0.5, 0.5));
  private uHalfSpan = uniform(0.005);
  private uAltSpan = uniform(0.0025);
  private uRadiusPx = uniform(4.0);
  private uFallSpeed = uniform(0.0);
  private uWindX = uniform(0.0);
  private uWindY = uniform(0.0);
  private uOpacity = uniform(0.8);
  private uColor = uniform(new THREE.Color(1, 1, 1));

  // Screen-space billboard uniforms — updated every frame.
  private uMainMatrix = uniform(new THREE.Matrix4());
  private uViewportW = uniform(1.0);
  private uViewportH = uniform(1.0);

  // Fog overlay
  private fogMesh: THREE.Mesh | null = null;
  private uFogOpacity = uniform(0.08);
  private _fogEnabled = true;

  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;

  async init(overlayCanvas: HTMLCanvasElement): Promise<boolean> {
    if (!(navigator as unknown as { gpu?: unknown }).gpu) {
      console.warn('[maplibre-gl-snow] WebGPU not supported');
      return false;
    }

    try {
      this.renderer = new THREE.WebGPURenderer({
        canvas: overlayCanvas,
        antialias: false,
        alpha: true,
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      await this.renderer.init();

      this.scene = new THREE.Scene();

      // PerspectiveCamera with identity projection override — positionNode emits clip-space
      // coords directly (no camera transform applied on top).
      this.camera = new THREE.PerspectiveCamera(60, 1, 0.001, 1000);
      this.camera.matrixAutoUpdate = false;
      this.camera.matrixWorld.identity();
      this.camera.matrixWorldInverse.identity();
      // Prevent Three.js from overwriting our projection matrix
      this.camera.updateProjectionMatrix = () => {};

      this._buildParticleSystem();
      this._buildFogOverlay();

      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[maplibre-gl-snow] WebGPU init failed:', err);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Particle system construction
  // -------------------------------------------------------------------------

  private _buildParticleSystem(): void {
    if (!this.renderer || !this.scene) return;

    const N = this.particleCount;

    // Storage buffers
    // posBuffer: vec3(mercX, mercY, mercAlt) — mercator [0,1] space
    // velBuffer: vec4(vx, vy, valt, seed)
    this.posBuffer = instancedArray(N, 'vec3');
    this.velBuffer = instancedArray(N, 'vec4');

    const randUint = () => uint(Math.floor(Math.random() * 0xffffff));

    // ----- computeInit -----
    const posBuffer = this.posBuffer;
    const velBuffer = this.velBuffer;
    const uCenter = this.uCenter;
    const uHalfSpan = this.uHalfSpan;
    const uAltSpan = this.uAltSpan;
    const uFallSpeed = this.uFallSpeed;

    const initFn = Fn(() => {
      const pos = posBuffer.element(instanceIndex);
      const vel = velBuffer.element(instanceIndex);

      const rx = hash(instanceIndex);
      const ry = hash(instanceIndex.add(randUint()));
      const rz = hash(instanceIndex.add(randUint()));
      const rs = hash(instanceIndex.add(randUint()));

      // Spawn in a box centered at uCenter
      // Spawn in a box centered at uCenter, scattered vertically
      pos.x = uCenter.x.add(rx.mul(uHalfSpan.mul(2.0)).sub(uHalfSpan));
      pos.y = uCenter.y.add(ry.mul(uHalfSpan.mul(2.0)).sub(uHalfSpan));
      pos.z = rz.mul(uAltSpan); // altitude [0, altSpan]
      // vel.z is a per-particle random multiplier [0.5, 1.0].
      // Actual fall delta = uFallSpeed * vel.z, computed live in update shader.
      vel.x = float(0.0);
      vel.y = float(0.0);
      vel.z = rs.mul(0.5).add(0.5); // random speed multiplier, NOT absolute speed
      vel.w = rs; // random seed for drift
    });

    this.computeInit = initFn().compute(N);

    // ----- computeUpdate -----
    const uWindX = this.uWindX;
    const uWindY = this.uWindY;

    const updateFn = Fn(() => {
      const pos = posBuffer.element(instanceIndex);
      const vel = velBuffer.element(instanceIndex);
      // Fall: actual delta = uFallSpeed * per-particle multiplier (vel.z)
      // Wind: uWindX / uWindY are already in merc-units/frame
      pos.x = pos.x.add(uWindX);
      pos.y = pos.y.add(uWindY);
      pos.z = pos.z.sub(uFallSpeed.mul(vel.z));

      // Only respawn when particle has fallen below ground (pos.z < 0).
      // No horizontal OOB check — that caused jitter when uCenter moved each frame.
      If(pos.z.lessThan(float(0.0)), () => {
        const rx2 = hash(
          instanceIndex.add(uint(Math.floor(Math.random() * 0xffffff))),
        );
        const ry2 = hash(
          instanceIndex.add(uint(Math.floor(Math.random() * 0xffffff))),
        );
        pos.x = uCenter.x.add(rx2.mul(uHalfSpan.mul(2.0)).sub(uHalfSpan));
        pos.y = uCenter.y.add(ry2.mul(uHalfSpan.mul(2.0)).sub(uHalfSpan));
        pos.z = uAltSpan; // respawn at top
      });
    });

    this.computeUpdate = updateFn().compute(N);

    // ----- Snow flake mesh -----
    // PlaneGeometry(2, 2): flat XY disc with zero Z-extent.
    // SphereGeometry caused a '+' artefact at pitched views because MapLibre's
    // mercator projection stretches altitude (Z), elongating the sphere's poles.
    // A flat plane in XY has no local Z → no altitude stretch.
    // posBuffer.element(instanceIndex) reads ONE particle position per-instance.
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    // DoubleSide (=2) not typed in three/webgpu; set at runtime so the plane
    // renders regardless of winding order after MapLibre's projection transform.
    Object.assign(material, { side: 2 });
    const uRadiusPx = this.uRadiusPx;
    const uColor = this.uColor;
    const uOpacity = this.uOpacity;
    const uMainMatrix = this.uMainMatrix;
    const uViewportW = this.uViewportW;
    const uViewportH = this.uViewportH;

    // Screen-space billboard positionNode:
    // 1. Build a vec4 center in mercator world space (w=1).
    // 2. Project it to clip space using MapLibre's main matrix.
    // 3. Convert to NDC, add pixel-aligned offsets, output as positionNode.
    // This is immune to mercator Z-scale distortion that broke the world-space billboard.
    const particlePos = posBuffer.element(instanceIndex);
    const center4 = vec4(
      particlePos.x,
      particlePos.y,
      particlePos.z,
      float(1.0),
    );
    const clipCenter = uMainMatrix.mul(center4);
    const w = clipCenter.w;
    // localX/localY are in [-1, 1] (PlaneGeometry). Convert radius from CSS pixels to NDC.
    const localX = dot(positionLocal, vec3(1, 0, 0));
    const localY = dot(positionLocal, vec3(0, 1, 0));
    const rNDC_x = uRadiusPx.mul(float(2.0)).div(uViewportW);
    const rNDC_y = uRadiusPx.mul(float(2.0)).div(uViewportH);
    const ndcX = clipCenter.x.div(w).add(localX.mul(rNDC_x));
    const ndcY = clipCenter.y.div(w).add(localY.mul(rNDC_y));
    const ndcZ = clipCenter.z.div(w);
    // positionNode is treated as clip-space by the identity camera.
    // Three.js appends w=1 giving gl_Position = vec4(ndcX, ndcY, ndcZ, 1) — correct.
    material.positionNode = vec3(ndcX, ndcY, ndcZ);

    // 3D sphere shading: crisp circular disc + Lambertian diffuse.
    // dist = 0 at UV centre, 0.5 at the disc edge (PlaneGeometry UV is [0,1]).
    // Quad corners reach dist ~0.707 and are fully transparent.
    const dist = uv().distance(float(0.5));
    // Crisp circular disc with soft antialiased edge (~1px falloff at rim).
    const mask = float(1.0).sub(smoothstep(float(0.42), float(0.5), dist));
    // Lambertian diffuse: bright at centre (normal faces viewer), dims at rim.
    const ndotl = float(1.0).sub(smoothstep(float(0.0), float(0.5), dist));
    // 30% ambient + 70% diffuse = full white centre, 30% grey rim -> sphere illusion.
    const brightness = float(0.3).add(ndotl.mul(float(0.7)));
    material.colorNode = vec4(uColor.mul(brightness), mask.mul(uOpacity));

    this.snowMesh = new THREE.Mesh(geometry, material);
    this.snowMesh.count = N;
    this.snowMesh.frustumCulled = false;

    this.scene.add(this.snowMesh);
  }

  private _buildFogOverlay(): void {
    if (!this.scene) return;

    // Fullscreen quad using NDC-space plane
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const uFogOpacity = this.uFogOpacity;

    // Radial vignette fog (blue-white tint)
    const vignette = screenUV.distance(float(0.5)).mul(2.0).saturate();
    mat.colorNode = vec4(
      color(0xffffff), // white atmospheric haze (matches Mapbox vignette-color: #ffffff)
      vignette.mul(uFogOpacity),
    );

    this.fogMesh = new THREE.Mesh(geo, mat);
    this.fogMesh.frustumCulled = false;
    this.fogMesh.renderOrder = 999;
    this.fogMesh.visible = this._fogEnabled;

    this.scene.add(this.fogMesh);
  }

  // -------------------------------------------------------------------------
  // Called by MaplibreSnowLayer.render() every frame
  // -------------------------------------------------------------------------

  frame(projMatrix: Float32Array, cssWidth: number, cssHeight: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.initialized)
      return;

    // Screen-space billboard: identity camera, matrix passed as uniform.
    // Three.js MVP = identity × identity = identity, so positionNode IS clip-space.
    this.camera.projectionMatrix.identity();
    this.camera.projectionMatrixInverse.identity();

    // Update screen-space billboard uniforms
    this.uMainMatrix.value.fromArray(projMatrix);
    this.uViewportW.value = cssWidth;
    this.uViewportH.value = cssHeight;

    // Run compute
    if (this.computeUpdate) {
      this.renderer.compute(this.computeUpdate);
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  // Called once on first render to initialize particle positions
  private _initRan = false;
  runInit(): void {
    if (this._initRan || !this.computeInit || !this.renderer) return;
    this.renderer.compute(this.computeInit);
    this._initRan = true;
  }

  // -------------------------------------------------------------------------
  // Uniform updates (called from MaplibreSnowLayer)
  // -------------------------------------------------------------------------

  updateSpatial(
    mercX: number,
    mercY: number,
    zoom: number,
    canvasCSSWidth: number,
  ): void {
    // Pixels per mercator unit at this zoom
    const pxToMerc = 1 / (512 * Math.pow(2, zoom));
    const halfSpan = canvasCSSWidth * pxToMerc * 1.2; // 120% of viewport width
    const altSpan = halfSpan * 0.5;

    this.uCenter.value.set(mercX, mercY);
    this.uHalfSpan.value = halfSpan;
    this.uAltSpan.value = altSpan;
    // Flake radius: stored separately, updated via setFlakeSize
    // (radius doesn't change per-frame unless user changes it)
  }

  updateFlakeRadiusPx(flakeSizePx: number): void {
    this.uRadiusPx.value = flakeSizePx;
  }

  updateWind(
    azimuthDeg: number,
    speedPxPerSec: number,
    zoom: number,
    fps: number,
  ): void {
    const pxToMerc = 1 / (512 * Math.pow(2, zoom));
    const azRad = (azimuthDeg * Math.PI) / 180;
    const mercSpeedPerFrame = (speedPxPerSec * pxToMerc) / fps;
    this.uWindX.value = Math.sin(azRad) * mercSpeedPerFrame;
    // mercY increases downward (southward), so negate cosine for northward component
    this.uWindY.value = Math.cos(azRad) * mercSpeedPerFrame;
  }

  updateFallSpeed(intensity: number, zoom: number, fps: number): void {
    const pxToMerc = 1 / (512 * Math.pow(2, zoom));
    // base fall = 40 px/s * intensity, converted to merc/frame
    this.uFallSpeed.value = (40 * intensity * pxToMerc) / fps;
  }

  // -------------------------------------------------------------------------
  // Public API setters
  // -------------------------------------------------------------------------

  setDensity(density: number): void {
    const newCount = Math.round(
      MIN_PARTICLE_COUNT +
        Math.max(0, Math.min(1, density)) *
          (MAX_PARTICLE_COUNT - MIN_PARTICLE_COUNT),
    );
    if (newCount === this.particleCount) return;
    this.particleCount = newCount;
    this._rebuildParticles();
  }

  private _rebuildParticles(): void {
    if (!this.scene) return;
    if (this.snowMesh) {
      this.scene.remove(this.snowMesh);
      this.snowMesh.geometry.dispose();
      (this.snowMesh.material as THREE.Material).dispose();
    }
    this._initRan = false;
    this._buildParticleSystem();
    // Re-run init on next frame
  }

  setOpacity(value: number): void {
    this.uOpacity.value = Math.max(0, Math.min(1, value));
  }

  setColor(r: number, g: number, b: number): void {
    this.uColor.value.setRGB(r, g, b);
  }

  setFog(enabled: boolean): void {
    this._fogEnabled = enabled;
    if (this.fogMesh) this.fogMesh.visible = enabled;
  }

  setFogOpacity(value: number): void {
    this.uFogOpacity.value = Math.max(0, Math.min(1, value));
  }

  resize(cssWidth: number, cssHeight: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(cssWidth, cssHeight);
  }

  dispose(): void {
    if (this.snowMesh) {
      this.snowMesh.geometry.dispose();
      (this.snowMesh.material as THREE.Material).dispose();
    }
    if (this.fogMesh) {
      this.fogMesh.geometry.dispose();
      (this.fogMesh.material as THREE.Material).dispose();
    }
    this.renderer?.dispose();
    this.resizeObserver?.disconnect();
  }

  get ready(): boolean {
    return this.initialized;
  }
}

// ---------------------------------------------------------------------------
// MapLibre Custom Layer
// ---------------------------------------------------------------------------

class MaplibreSnowLayer {
  id: string;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MaplibreMap | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayDiv: HTMLDivElement | null = null;
  private gpu: SnowGPU | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Options
  private _density: number;
  private _intensity: number;
  private _flakeSize: number;
  private _opacity: number;
  private _direction: [number, number];
  private _fog: boolean;
  private _fogOpacity: number;

  // Frame timing
  private _lastFrameTime = 0;
  private _fps = 60;

  constructor(options: MaplibreSnowOptions = {}) {
    this.id = options.id ?? 'snow';
    this._density = options.density ?? 0.5;
    this._intensity = options.intensity ?? 0.5;
    this._flakeSize = options.flakeSize ?? 4;
    this._opacity = options.opacity ?? 0.8;
    this._direction = options.direction ?? [0, 50];
    this._fog = options.fog ?? true;
    this._fogOpacity = options.fogOpacity ?? 0.08;
  }

  // -------------------------------------------------------------------------
  // MapLibre lifecycle
  // -------------------------------------------------------------------------

  onAdd(
    map: MaplibreMap,
    _gl: WebGL2RenderingContext | WebGLRenderingContext,
  ): void {
    this.map = map;

    const container = map.getContainer();
    container.style.position = 'relative';

    // Overlay div
    this.overlayDiv = document.createElement('div');
    Object.assign(this.overlayDiv.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
    });

    // Overlay canvas
    this.overlayCanvas = document.createElement('canvas');
    Object.assign(this.overlayCanvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
    });

    this.overlayDiv.appendChild(this.overlayCanvas);
    container.appendChild(this.overlayDiv);

    // Physical canvas size
    const dpr = window.devicePixelRatio;
    this.overlayCanvas.width = container.clientWidth * dpr;
    this.overlayCanvas.height = container.clientHeight * dpr;

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.overlayCanvas || !this.map) return;
      const c = this.map.getContainer();
      const d = window.devicePixelRatio;
      this.overlayCanvas.width = c.clientWidth * d;
      this.overlayCanvas.height = c.clientHeight * d;
      this.gpu?.resize(c.clientWidth, c.clientHeight);
    });
    this.resizeObserver.observe(container);

    // Init WebGPU async
    this.gpu = new SnowGPU();
    this.gpu.init(this.overlayCanvas).then((ok) => {
      if (!ok) return;
      // Apply initial options after init
      this.gpu!.setDensity(this._density);
      this.gpu!.setOpacity(this._opacity);
      this.gpu!.setFog(this._fog);
      this.gpu!.setFogOpacity(this._fogOpacity);
    });
  }

  render(
    _gl: WebGL2RenderingContext | WebGLRenderingContext,
    args: CustomRenderMethodInput,
  ): void {
    if (!this.gpu?.ready || !this.map) return;
    const now = performance.now();
    const dt = now - this._lastFrameTime;
    if (this._lastFrameTime > 0 && dt > 0) {
      const instantFps = 1000 / dt;
      this._fps = this._fps * 0.9 + instantFps * 0.1;
    }
    this._lastFrameTime = now;
    const fps = Math.max(10, Math.min(120, this._fps));
    const zoom = this.map.getZoom();
    const center = this.map.getCenter();
    const cssW = this.map.getContainer().clientWidth;
    const merc = lngLatToMercator(center.lng, center.lat);
    this.gpu.updateSpatial(merc.x, merc.y, zoom, cssW);
    this.gpu.updateFlakeRadiusPx(this._flakeSize);
    this.gpu.updateWind(this._direction[0], this._direction[1], zoom, fps);
    this.gpu.updateFallSpeed(this._intensity, zoom, fps);
    this.gpu.runInit();
    const cssH = this.map.getContainer().clientHeight;
    this.gpu.frame(
      new Float32Array(args.defaultProjectionData.mainMatrix),
      cssW,
      cssH,
    );
    this.map.triggerRepaint();
  }

  onRemove(
    _map: MaplibreMap,
    _gl: WebGL2RenderingContext | WebGLRenderingContext,
  ): void {
    this.resizeObserver?.disconnect();
    this.gpu?.dispose();

    if (this.overlayDiv?.parentElement) {
      this.overlayDiv.parentElement.removeChild(this.overlayDiv);
    }

    this.map = null;
    this.overlayDiv = null;
    this.overlayCanvas = null;
    this.gpu = null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  setDensity(density: number): void {
    this._density = density;
    this.gpu?.setDensity(density);
  }

  setIntensity(intensity: number): void {
    this._intensity = Math.max(0, Math.min(1, intensity));
  }

  setFlakeSize(size: number): void {
    this._flakeSize = size;
    this.gpu?.updateFlakeRadiusPx(size);
  }

  setOpacity(opacity: number): void {
    this._opacity = opacity;
    this.gpu?.setOpacity(opacity);
  }

  setDirection(direction: [number, number]): void {
    this._direction = direction;
  }

  setFog(enabled: boolean): void {
    this._fog = enabled;
    this.gpu?.setFog(enabled);
  }

  setFogOpacity(opacity: number): void {
    this._fogOpacity = opacity;
    this.gpu?.setFogOpacity(opacity);
  }
}

export { MaplibreSnowLayer };
