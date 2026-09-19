import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A signature pad, drawn on a canvas (WF-L-07).
 *
 * No library: a signature is a path and a data URL, and pulling in a dependency
 * for that would be the larger change. Pointer events rather than mouse or
 * touch events, because this is used on a tablet at a customer's door and
 * pointer is the one API that covers a finger, a stylus and a mouse without
 * three code paths.
 *
 * `touch-none` on the canvas is load-bearing: without it the browser treats a
 * drag as a scroll and the customer's signature comes out as a single dot.
 */
export function SignaturePad({
  onChange,
  disabled,
  label = 'Sign here',
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The canvas is sized in CSS pixels but drawn in device pixels, or the line
    // is soft on every retina screen a technician owns.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = pointAt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointAt(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px]"
          onClick={clear}
          disabled={disabled || !hasInk}
        >
          Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={label}
        role="img"
        className="h-40 w-full touch-none rounded-lg border bg-background"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      {!hasInk && (
        <p className="text-xs text-muted-foreground">
          Draw with a finger, a stylus or a mouse. Nothing is submitted until you sign.
        </p>
      )}
    </div>
  );
}
