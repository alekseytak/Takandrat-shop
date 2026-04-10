import React, { useState, useEffect } from 'react';

export const TorusLogo: React.FC<{ className?: string }> = ({ className }) => {
  const R = 20; // Major radius (smaller for tighter hole)
  const r = 19.5; // Minor radius (almost equal to R for near-zero hole)
  const stepsU = 24; // Longitudinal segments
  const stepsV = 24; // Latitudinal segments

  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let frameId: number;
    const animate = (time: number) => {
      // Increase speed: time * 0.001 is standard, 0.002 is faster
      setRotation({
        x: time * 0.0008,
        y: time * 0.0012,
        z: time * 0.0005
      });
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 3D to 2D projection with dynamic rotation
  const project = (u: number, v: number) => {
    let x = (R + r * Math.cos(v)) * Math.cos(u);
    let y = (R + r * Math.cos(v)) * Math.sin(u);
    let z = r * Math.sin(v);

    // Rotate around X
    let y1 = y * Math.cos(rotation.x) - z * Math.sin(rotation.x);
    let z1 = y * Math.sin(rotation.x) + z * Math.cos(rotation.x);
    y = y1; z = z1;

    // Rotate around Y
    let x2 = x * Math.cos(rotation.y) + z * Math.sin(rotation.y);
    let z2 = -x * Math.sin(rotation.y) + z * Math.cos(rotation.y);
    x = x2; z = z2;

    // Rotate around Z
    let x3 = x * Math.cos(rotation.z) - y * Math.sin(rotation.z);
    let y3 = x * Math.sin(rotation.z) + y * Math.cos(rotation.z);
    x = x3; y = y3;

    // Perspective projection
    const perspective = 150 / (150 + z);
    return { x: 50 + x * perspective, y: 50 + y * perspective };
  };

  const paths: string[] = [];

  // Longitudinal lines
  for (let i = 0; i < stepsU; i++) {
    const u = (i * Math.PI * 2) / stepsU;
    let d = "";
    for (let j = 0; j <= stepsV; j++) {
      const v = (j * Math.PI * 2) / stepsV;
      const p = project(u, v);
      d += (j === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2);
    }
    paths.push(d);
  }

  // Latitudinal lines
  for (let j = 0; j < stepsV; j++) {
    const v = (j * Math.PI * 2) / stepsV;
    let d = "";
    for (let i = 0; i <= stepsU; i++) {
      const u = (i * Math.PI * 2) / stepsU;
      const p = project(u, v);
      d += (i === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2);
    }
    paths.push(d);
  }

  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
      <g>
        {paths.map((d, i) => (
          <path 
            key={i} 
            d={d} 
            opacity={0.3 + (i % 5) * 0.1} 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
      {/* Central core */}
      <circle cx="50" cy="50" r="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
};
