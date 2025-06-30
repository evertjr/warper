import * as THREE from "three";

// Shader that accumulates displacement into displacement map
export const BrushShader = {
  uniforms: {
    uPrevDisp: { value: null }, // previous displacement texture
    uMouse: { value: new THREE.Vector2(0, 0) },
    uPrevMouse: { value: new THREE.Vector2(0, 0) },
    uBrushSize: { value: 0.1 },
    uBrushStrength: { value: 0.1 },
    uAspect: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uPrevDisp;
    uniform vec2 uMouse;
    uniform vec2 uPrevMouse;
    uniform float uBrushSize;
    uniform float uBrushStrength;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      // Read previous displacement
      vec2 disp = texture2D(uPrevDisp, vUv).rg;

      // Compute displacement update
      float dist = length((vUv - uMouse) * vec2(uAspect, 1.0));
      if (dist < uBrushSize) {
        vec2 toMouse = (uMouse - uPrevMouse);
        float normalized = dist / uBrushSize;
        float exponent = mix(1.0, 8.0, clamp(uBrushStrength, 0.0, 1.0));
        float falloff = pow(clamp(1.0 - normalized, 0.0, 1.0), exponent);
        disp += toMouse * falloff * uBrushStrength;
      }

      gl_FragColor = vec4(disp, 0.0, 1.0);
    }
  `,
};
