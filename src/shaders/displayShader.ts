// Shader that displays original texture warped by displacement map
import * as THREE from "three";

export const DisplayShader = {
  uniforms: {
    uTexture: { value: null }, // original image
    uDisplacement: { value: null },
    uExposure: { value: 1.0 },
    uBlackPoint: { value: 0.0 }, // 0-0.1 typical
    uWhitePoint: { value: 1000.0 }, // A very large value effectively disables Reinhard tone-mapping
    uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // per-channel multiplier
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #include <common>
    uniform sampler2D uTexture;
    uniform sampler2D uDisplacement;
    uniform float uExposure;
    uniform float uBlackPoint;
    uniform float uWhitePoint;
    uniform vec3 uTint;
    varying vec2 vUv;

    void main() {
      vec2 disp = texture2D(uDisplacement, vUv).rg;
      vec2 sampleUv = vUv - disp;
      // input texture is already in linear space thanks to THREE's sRGB decode
      vec3 color = texture2D(uTexture, sampleUv).rgb;

      // Apply exposure
      color *= uExposure;

      // Black-point adjustment (lift or crush shadows)
      //   uBlackPoint > 0  -> deeper blacks (crush)
      //   uBlackPoint < 0  -> raised blacks (lift)
      color = max(color - vec3(uBlackPoint), 0.0);

      // White-point / highlight compression (Reinhard-style)
      // A large uWhitePoint value effectively disables this effect.
      color = color / (vec3(1.0) + color / vec3(max(uWhitePoint, 1e-4)));

      // Apply tint to counter any color cast
      color *= uTint;

      gl_FragColor = vec4(color, 1.0);

      // Let Three.js handle conversion from linear to the output colorspace (sRGB)
      #include <colorspace_fragment>
    }
  `,
};
