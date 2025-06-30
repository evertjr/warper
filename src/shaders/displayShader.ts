// Shader that displays original texture warped by displacement map
export const DisplayShader = {
  uniforms: {
    uTexture: { value: null }, // original image
    uDisplacement: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform sampler2D uDisplacement;
    varying vec2 vUv;

    void main() {
      vec2 disp = texture2D(uDisplacement, vUv).rg;
      vec2 sampleUv = vUv - disp;
      vec4 color = texture2D(uTexture, sampleUv);
      // Convert linear to sRGB for display
      color.rgb = pow(color.rgb, vec3(1.0/2.2));
      gl_FragColor = color;
    }
  `,
};
