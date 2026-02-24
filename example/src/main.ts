import maplibregl from 'maplibre-gl';
import { MaplibreSnowLayer } from '@geoql/maplibre-gl-snow';
import './style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-74.006, 40.7128],
  zoom: 13,
  pitch: 55,
  bearing: -15,
  maxPitch: 85,
});

map.on('load', () => {
  const snow = new MaplibreSnowLayer({
    density: 0.5,
    intensity: 0.5,
    flakeSize: 4,
    opacity: 0.8,
    direction: [0, 50],
    fog: true,
    fogOpacity: 0.08,
  });

  map.addLayer(snow);

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    'top-right',
  );

  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

  const $density = $<HTMLInputElement>('density');
  const $intensity = $<HTMLInputElement>('intensity');
  const $flakesize = $<HTMLInputElement>('flakesize');
  const $opacity = $<HTMLInputElement>('opacity');
  const $windh = $<HTMLInputElement>('windh');
  const $windv = $<HTMLInputElement>('windv');
  const $fogToggle = $<HTMLInputElement>('fog-toggle');
  const $fogOpacity = $<HTMLInputElement>('fogopacity');

  const $densityVal = $<HTMLSpanElement>('density-val');
  const $intensityVal = $<HTMLSpanElement>('intensity-val');
  const $flakesizeVal = $<HTMLSpanElement>('flakesize-val');
  const $opacityVal = $<HTMLSpanElement>('opacity-val');
  const $windhVal = $<HTMLSpanElement>('windh-val');
  const $windvVal = $<HTMLSpanElement>('windv-val');
  const $fogOpacityVal = $<HTMLSpanElement>('fogopacity-val');

  $density.addEventListener('input', () => {
    const v = Number($density.value) / 100;
    $densityVal.textContent = v.toFixed(2);
    snow.setDensity(v);
  });

  $intensity.addEventListener('input', () => {
    const v = Number($intensity.value) / 100;
    $intensityVal.textContent = v.toFixed(2);
    snow.setIntensity(v);
  });

  $flakesize.addEventListener('input', () => {
    const v = Number($flakesize.value);
    $flakesizeVal.textContent = String(v);
    snow.setFlakeSize(v);
  });

  $opacity.addEventListener('input', () => {
    const v = Number($opacity.value) / 100;
    $opacityVal.textContent = v.toFixed(2);
    snow.setOpacity(v);
  });

  $windh.addEventListener('input', () => {
    const v = Number($windh.value);
    $windhVal.textContent = String(v);
    snow.setDirection([v, Number($windv.value)]);
  });

  $windv.addEventListener('input', () => {
    const v = Number($windv.value);
    $windvVal.textContent = String(v);
    snow.setDirection([Number($windh.value), v]);
  });

  $fogToggle.addEventListener('change', () => {
    snow.setFog($fogToggle.checked);
  });

  $fogOpacity.addEventListener('input', () => {
    const v = Number($fogOpacity.value) / 100;
    $fogOpacityVal.textContent = v.toFixed(2);
    snow.setFogOpacity(v);
  });
});
