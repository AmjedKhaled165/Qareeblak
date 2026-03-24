"use client";

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from 'next-themes';

// Generate random points on a sphere
function randomInSphere(numPoints: number, radius: number) {
    const points = new Float32Array(numPoints * 3);
    for (let i = 0; i < numPoints; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(Math.random() * 2 - 1);
        const r = Math.cbrt(Math.random()) * radius;

        points[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        points[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        points[i * 3 + 2] = r * Math.cos(phi);
    }
    return points;
}

function StarField({ isDark }: { isDark: boolean }) {
    const ref = useRef<THREE.Points>(null);
    // Reduced particle count from 1500 to 800 for silky smooth performance on any device
    const sphere = useMemo(() => randomInSphere(800, 1.8), []);

    useFrame((state, delta) => {
        if (ref.current) {
            // Slower, more elegant rotation
            ref.current.rotation.x -= delta / 15;
            ref.current.rotation.y -= delta / 20;
            
            // Subtle hover reaction based on pointer
            const targetX = (state.pointer.x * 0.15);
            const targetY = (state.pointer.y * 0.15);
            ref.current.rotation.x += 0.05 * (targetY - ref.current.rotation.x);
            ref.current.rotation.y += 0.05 * (targetX - ref.current.rotation.y);
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={true}>
                <PointMaterial
                    transparent
                    // Light mode gets deep intense indigo, Dark mode gets glowing neon indigo/fuchsia
                    color={isDark ? "#818cf8" : "#4338ca"}
                    size={isDark ? 0.008 : 0.012}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={isDark ? 0.8 : 0.6}
                />
            </Points>
        </group>
    );
}

export function Hero3DCanvas() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Detect mobile to save battery and ensure 0 lag on phones
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const isDark = resolvedTheme === 'dark';

    if (!mounted || isMobile) return null;

    return (
        <div className="absolute inset-0 z-0 opacity-40 sm:opacity-60 transition-opacity duration-1000 pointer-events-none mix-blend-multiply dark:mix-blend-screen">
            {/* Limit DPR to 1.5 and disable antialias on points to maximize performance to 0 lag */}
            <Canvas 
                camera={{ position: [0, 0, 1] }}
                dpr={[1, 1.5]}
                gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
            >
                <StarField isDark={isDark} />
            </Canvas>
        </div>
    );
}
