
import React, { useEffect, useState, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export const TorusLogo: React.FC<{ className?: string }> = ({ className }) => {
  const [rotation, setRotation] = useState(0);
  const requestRef = useRef<number>(0);
  
  // Конфигурация тора (Horn Torus: R ≈ r)
  const R = 20; // Радиус траектории центра трубы
  const r = 20; // Радиус самой трубы
  
  // Количество линий сетки
  const numPoloidal = 12; // Вертикальные кольца (меридианы)
  const numToroidal = 9;  // Горизонтальные кольца (параллели)
  
  // Детализация линий (количество сегментов на линию)
  const segments = 60; 

  const animate = () => {
    // Вращение по всем осям
    setRotation(prev => (prev + 0.01) % (Math.PI * 100));
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const project = (p: Point3D): { x: number, y: number } => {
    // 1. Вращение вокруг оси Z (основное)
    const rz = rotation;
    const x1 = p.x * Math.cos(rz) - p.y * Math.sin(rz);
    const y1 = p.x * Math.sin(rz) + p.y * Math.cos(rz);
    const z1 = p.z;

    // 2. Вращение вокруг оси X (наклон к зрителю)
    const rx = rotation * 0.7 + 0.5; // +0.5 добавляет начальный наклон
    const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);
    const x2 = x1;

    // 3. Вращение вокруг оси Y (медленное покачивание)
    const ry = rotation * 0.2;
    const x3 = x2 * Math.cos(ry) + z2 * Math.sin(ry);
    const z3 = -x2 * Math.sin(ry) + z2 * Math.cos(ry);
    const y3 = y2;
    
    // Перспектива
    const perspective = 400;
    const scale = perspective / (perspective + z3);
    
    return {
      x: 50 + x3 * scale,
      y: 50 + y3 * scale
    };
  };

  const renderWireframe = () => {
    const paths = [];

    // 1. Рисуем вертикальные кольца (Poloidal) - Меридианы
    // Они проходят через центр (дырку бублика)
    for (let i = 0; i < numPoloidal; i++) {
      const phi = (i / numPoloidal) * Math.PI * 2; // Угол поворота плоскости сечения
      let d = "";
      
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2; // Угол внутри сечения
        
        // Формула тора
        const px = (R + r * Math.cos(theta)) * Math.cos(phi);
        const py = (R + r * Math.cos(theta)) * Math.sin(phi);
        const pz = r * Math.sin(theta);

        const point = project({ x: px, y: py, z: pz });
        
        if (j === 0) d += `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        else d += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }
      
      paths.push(
        <path 
          key={`poly-${i}`} 
          d={d} 
          stroke="currentColor" 
          fill="none" 
          strokeWidth="0.5" // Тонкие линии
        />
      );
    }

    // 2. Рисуем горизонтальные кольца (Toroidal) - Параллели
    // Исключаем i=0 (центр трубы) чтобы не было артефактов, или рисуем все
    for (let i = 0; i < numToroidal; i++) {
      const theta = (i / numToroidal) * Math.PI * 2;
      let d = "";
      
      // Если это самый центр (theta = PI), радиус может быть 0, пропускаем
      
      for (let j = 0; j <= segments; j++) {
        const phi = (j / segments) * Math.PI * 2;
        
        const px = (R + r * Math.cos(theta)) * Math.cos(phi);
        const py = (R + r * Math.cos(theta)) * Math.sin(phi);
        const pz = r * Math.sin(theta);
        
        const point = project({ x: px, y: py, z: pz });
        
        if (j === 0) d += `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        else d += ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }
      
      paths.push(
        <path 
          key={`toro-${i}`} 
          d={d} 
          stroke="currentColor" 
          fill="none" 
          strokeWidth="0.5"
        />
      );
    }

    return paths;
  };

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }} 
    >
      {renderWireframe()}
    </svg>
  );
};
