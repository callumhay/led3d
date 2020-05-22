export const VOXEL_EPSILON = 0.00001;
export const VOXEL_ERR_UNITS = 1.0 / (2.0 + VOXEL_EPSILON);

export const SQRT3   = 1.73205080757;
export const SQRT2PI = 4.44288293816;

export const hslToHsvColor = (hsl) => {
  const v = hsl.l + hsl.s*Math.min(hsl.l,1-hsl.l);
  return {h:hsl.h, s: v == 0 ? 0 : 2-2*hsl.l/v, v:v};
}
export const hsvToHslColor = (hsv) => {
  const l = hsv.v - hsv.v*hsv.s/2.0;
  const hsl = new THREE.Color();
  hsl.setHSL(hsv.h, l === 0 || l === 1 ? 0 : ((hsv.v-l)/Math.min(l,1-l)), l);
}

export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
}