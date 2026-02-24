interface TslNode {
  add(other: TslNode | number): TslNode;
  sub(other: TslNode | number): TslNode;
  mul(other: TslNode | number): TslNode;
  lessThan(other: TslNode | number): TslNode;
  saturate(): TslNode;
  distance(other: TslNode | number): TslNode;
  toAttribute(): TslNode;
  element(index: TslNode): TslWritableElement;
}

interface TslWritableElement extends TslNode {
  x: TslNode;
  y: TslNode;
  z: TslNode;
  w: TslNode;
}

interface TslUniform<T> extends TslWritableElement {
  value: T;
}

interface TslNodeWithCompute extends TslNode {
  compute(count: number): TslComputePipeline;
}

interface TslComputePipeline {
  readonly _isComputePipeline: true;
}

type TslFnCallable = (() => TslNodeWithCompute) & {
  compute(count: number): TslComputePipeline;
};

declare module 'three/webgpu' {
  class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): this;
  }

  class Matrix4 {
    fromArray(array: ArrayLike<number>, offset?: number): this;
    identity(): this;
    copy(m: Matrix4): this;
    invert(): this;
  }

  class Color {
    constructor(r: number, g: number, b: number);
    r: number;
    g: number;
    b: number;
    setRGB(r: number, g: number, b: number): this;
  }

  class BufferGeometry {
    dispose(): void;
  }

  class SphereGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
    );
  }

  class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number);
  }

  class Material {
    dispose(): void;
  }

  class MeshBasicNodeMaterial extends Material {
    constructor(options?: {
      transparent?: boolean;
      depthWrite?: boolean;
      depthTest?: boolean;
    });
    positionNode: TslNode | null;
    colorNode: TslNode | null;
  }

  class Mesh {
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    material: Material;
    count: number;
    frustumCulled: boolean;
    visible: boolean;
    renderOrder: number;
  }

  class Scene {
    add(object: Mesh): void;
    remove(object: Mesh): void;
  }

  class PerspectiveCamera {
    constructor(fov: number, aspect: number, near: number, far: number);
    matrixAutoUpdate: boolean;
    matrixWorld: Matrix4;
    matrixWorldInverse: Matrix4;
    projectionMatrix: Matrix4;
    projectionMatrixInverse: Matrix4;
    updateProjectionMatrix(): void;
  }

  class WebGPURenderer {
    constructor(options?: {
      canvas?: HTMLCanvasElement;
      antialias?: boolean;
      alpha?: boolean;
    });
    init(): Promise<void>;
    render(scene: Scene, camera: PerspectiveCamera): void;
    compute(pipeline: TslComputePipeline): void;
    setSize(width: number, height: number): void;
    setClearColor(color: number, alpha: number): void;
    setPixelRatio(ratio: number): void;
    dispose(): void;
  }
}

declare module 'three/tsl' {
  import type { Vector2, Color } from 'three/webgpu';

  export function Fn(fn: () => void): TslFnCallable;
  export function float(value: number): TslNode;
  export function uint(value: number): TslNode;
  export function vec4(x: TslNode | Color, y: TslNode | number): TslNode;
  export const instanceIndex: TslNode;
  export function instancedArray(count: number, type: string): TslNode;
  export const positionLocal: TslNode;
  export function uniform(value: Vector2): TslUniform<Vector2>;
  export function uniform(value: Color): TslUniform<Color>;
  export function uniform(value: number): TslUniform<number>;
  export function hash(seed: TslNode): TslNode;
  export function If(condition: TslNode, thenFn: () => void): void;
  export function color(hex: number): TslNode;
  export const screenUV: TslNode;
}
