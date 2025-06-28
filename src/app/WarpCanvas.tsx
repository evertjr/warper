import { useRef, useState, forwardRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const WarpShader = {
  uniforms: {
    uTexture: { value: null },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uPrevMouse: { value: new THREE.Vector2(0, 0) },
    uBrushSize: { value: 0.1 },
    uBrushStrength: { value: 0.1 },
    uWarpActive: { value: false },
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
    uniform vec2 uMouse;
    uniform vec2 uPrevMouse;
    uniform float uBrushSize;
    uniform float uBrushStrength;
    uniform bool uWarpActive;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      if (uWarpActive) {
        float distance = length(uv - uMouse);
        if (distance < uBrushSize) {
          vec2 toMouse = uMouse - uPrevMouse;
          float falloff = 1.0 - smoothstep(0.0, uBrushSize, distance);
          uv -= toMouse * falloff * uBrushStrength;
        }
      }
      gl_FragColor = texture2D(uTexture, uv);
    }
  `,
};

function WarpEffect({ image, brushSize, brushStrength, zoom }) {
  const { gl, viewport } = useThree();
  const texture = useTexture(image);
  const shaderRef = useRef<THREE.ShaderMaterial>();
  const [isWarping, setIsWarping] = useState(false);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const prevMouse = useRef(new THREE.Vector2(0, 0));

  const fbo1 = useMemo(() => new THREE.WebGLRenderTarget(gl.domElement.width, gl.domElement.height), [gl]);
  const fbo2 = useMemo(() => new THREE.WebGLRenderTarget(gl.domElement.width, gl.domElement.height), [gl]);
  let currentFBO = fbo1;
  let nextFBO = fbo2;

  useEffect(() => {
    // Initialize FBOs with the original texture
    gl.setRenderTarget(fbo1);
    gl.render(new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture }))), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    gl.setRenderTarget(fbo2);
    gl.render(new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture }))), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    gl.setRenderTarget(null);
  }, [texture, gl, fbo1, fbo2]);

  useFrame(({ pointer }) => {
    prevMouse.current.copy(mouse.current);
    mouse.current.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);

    if (isWarping && shaderRef.current) {
      shaderRef.current.uniforms.uWarpActive.value = true;
      shaderRef.current.uniforms.uMouse.value = mouse.current;
      shaderRef.current.uniforms.uPrevMouse.value = prevMouse.current;
      shaderRef.current.uniforms.uTexture.value = currentFBO.texture;

      gl.setRenderTarget(nextFBO);
      gl.render(new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderRef.current)), new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
      gl.setRenderTarget(null);

      // Swap FBOs
      [currentFBO, nextFBO] = [nextFBO, currentFBO];
    } else {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uWarpActive.value = false;
        }
    }
  });

  const handlePointerDown = (e) => {
    setIsWarping(true);
    mouse.current.set(e.pointer.x * 0.5 + 0.5, e.pointer.y * 0.5 + 0.5);
    prevMouse.current.copy(mouse.current);
  };

  const handlePointerUp = () => {
    setIsWarping(false);
  };

  const scale = useMemo(() => {
    const imageAspect = texture.image.width / texture.image.height;
    const screenAspect = viewport.width / viewport.height;
    if (imageAspect > screenAspect) {
      return [viewport.width * zoom, (viewport.width / imageAspect) * zoom, 1];
    } else {
      return [viewport.height * imageAspect * zoom, viewport.height * zoom, 1];
    }
  }, [texture, viewport, zoom]);

  return (
    <mesh scale={scale} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerOut={handlePointerUp}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={shaderRef}
        args={[WarpShader]}
        uniforms-uBrushSize-value={brushSize / 200}
        uniforms-uBrushStrength-value={brushStrength / 500}
      />
       <primitive object={new THREE.MeshBasicMaterial({ map: currentFBO.texture })} />
    </mesh>
  );
}

const WarpCanvas = forwardRef(({ image, brushSize, brushStrength, zoom }, ref) => {
  return (
    <Canvas ref={ref} gl={{ preserveDrawingBuffer: true }}>
      <WarpEffect image={image} brushSize={brushSize} brushStrength={brushStrength} zoom={zoom} />
    </Canvas>
  );
});

WarpCanvas.displayName = "WarpCanvas";

export default WarpCanvas;