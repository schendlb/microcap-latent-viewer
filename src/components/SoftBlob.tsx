import { useRef, useMemo } from 'react'
import { ShaderMaterial, Color } from 'three'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

interface Props {
  position: [number, number, number]
  radius: number
  color: string
  opacity: number
  emissiveIntensity?: number
  scale?: number
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}

export function SoftBlob({
  position,
  radius,
  color,
  opacity,
  emissiveIntensity = 0.3,
  scale = 1,
  onPointerOver,
  onPointerOut,
  onClick,
}: Props) {
  const meshRef = useRef<Mesh>(null)
  
  const material = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uOpacity: { value: opacity },
        uEmissiveIntensity: { value: emissiveIntensity },
        uRadius: { value: radius },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uEmissiveIntensity;
        uniform float uRadius;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          // Distance from center (SDF-like)
          float dist = length(vPosition);
          float normalizedDist = dist / uRadius;
          
          // Soft falloff: stronger at center, fades at edges
          float density = 1.0 - smoothstep(0.0, 1.0, normalizedDist);
          density = pow(density, 2.5); // Sharper falloff
          
          // Fresnel effect for volumetric feel
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
          
          // Combine density with fresnel for soft glow
          float alpha = density * uOpacity * (0.6 + 0.4 * fresnel);
          
          // Emissive glow effect
          vec3 emissive = uColor * uEmissiveIntensity * density;
          
          // Diffuse shading (subtle)
          vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
          float diffuse = max(0.0, dot(vNormal, lightDir)) * 0.5 + 0.5;
          
          vec3 finalColor = uColor * diffuse + emissive;
          
          // Soft particle effect: increase brightness at edges
          finalColor += uColor * fresnel * 0.3;
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    })
    
    return mat
  }, [color, opacity, emissiveIntensity, radius])

  // Update uniforms when props change
  useMemo(() => {
    material.uniforms.uColor.value.set(color)
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uEmissiveIntensity.value = emissiveIntensity
    material.uniforms.uRadius.value = radius
  }, [material, color, opacity, emissiveIntensity, radius])

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      material={material}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <sphereGeometry args={[radius, 32, 32]} />
    </mesh>
  )
}
