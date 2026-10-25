/** Every control the demo exposes, in the units the panel shows. */
export interface SnowSettings {
  /** 0–1 */
  density: number;
  /** 0–1 */
  intensity: number;
  /** CSS px */
  flakeSize: number;
  /** 0–1 */
  opacity: number;
  /** Wind azimuth, degrees (0 = north, clockwise). */
  windAzimuth: number;
  /** Wind horizontal speed, px/s. */
  windSpeed: number;
  fog: boolean;
  /** 0–1 */
  fogOpacity: number;
}

/** The library defaults (README "Options"). */
export const DEFAULT_SETTINGS: Readonly<SnowSettings> = {
  density: 0.5,
  intensity: 0.5,
  flakeSize: 4,
  opacity: 0.8,
  windAzimuth: 0,
  windSpeed: 50,
  fog: true,
  fogOpacity: 0.08,
};
