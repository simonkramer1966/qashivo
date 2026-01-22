import { useEffect, useRef } from "react";

interface OscilloscopeProps {
  isActive: boolean;
  className?: string;
}

export function Oscilloscope({ isActive, className = "" }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.fillStyle = "rgba(11, 15, 23, 0.15)";
      ctx.fillRect(0, 0, width, height);

      if (isActive) {
        phaseRef.current += 0.08;

        ctx.beginPath();
        ctx.strokeStyle = "#12B8C4";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#12B8C4";
        ctx.shadowBlur = 10;

        for (let x = 0; x < width; x++) {
          const normalizedX = x / width;
          const wave1 = Math.sin(normalizedX * Math.PI * 4 + phaseRef.current) * 20;
          const wave2 = Math.sin(normalizedX * Math.PI * 8 + phaseRef.current * 1.5) * 10;
          const wave3 = Math.sin(normalizedX * Math.PI * 2 + phaseRef.current * 0.7) * 15;
          const noise = (Math.random() - 0.5) * 8;
          const amplitude = 0.6 + Math.sin(phaseRef.current * 0.3) * 0.4;
          const y = centerY + (wave1 + wave2 + wave3 + noise) * amplitude;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(18, 184, 196, 0.3)";
        ctx.lineWidth = 1;

        for (let x = 0; x < width; x++) {
          const normalizedX = x / width;
          const wave = Math.sin(normalizedX * Math.PI * 6 + phaseRef.current * 0.5) * 25;
          const y = centerY + wave;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(18, 184, 196, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ background: "transparent" }}
    />
  );
}
