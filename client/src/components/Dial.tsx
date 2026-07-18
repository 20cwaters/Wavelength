import { useRef } from 'react';
import { DIAL_MAX, DIAL_MIN } from '../../../shared/constants';
import { wedgeRanges } from '../../../shared/game';
import { polar, sectorPath } from '../dialMath';

const W = 720;
const H = 404;
const CX = 360;
const CY = 372;
const R = 330;

const WEDGE_COLORS: Record<number, string> = { 4: '#f59e0b', 3: '#2dd4bf', 2: '#60a5fa' };

export interface DialMarker {
  value: number;
  label: string;
  color: string;
}

interface DialProps {
  value: number;
  /** Target position; null hides the scoring wedges (non-psychic views). */
  target: number | null;
  interactive: boolean;
  locked?: boolean;
  /** Extra labeled needles — used at party-mode reveal to show everyone's guess. */
  markers?: DialMarker[];
  /** Hide the main pointer (e.g. authoring view / party reveal). */
  showPointer?: boolean;
  onChange?: (v: number) => void;
  /** Fired when a drag ends — lets the parent flush the final position. */
  onCommit?: (v: number) => void;
}

export default function Dial({
  value,
  target,
  interactive,
  locked,
  markers,
  showPointer = true,
  onChange,
  onCommit,
}: DialProps) {
  const dragging = useRef(false);

  function valueFromEvent(e: React.PointerEvent<SVGSVGElement>): number | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const dx = x - CX;
    const dy = CY - y;
    if (dx * dx + dy * dy < 144) return null; // too close to the hub to read an angle
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg = dx < 0 ? 180 : 0; // clicks below the baseline snap to the ends
    return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(180 - deg)));
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = valueFromEvent(e);
    if (v !== null) onChange?.(v);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !dragging.current) return;
    const v = valueFromEvent(e);
    if (v !== null) onChange?.(v);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const v = valueFromEvent(e);
    onCommit?.(v ?? value);
  };

  const [px, py] = polar(CX, CY, R + 10, value);
  const wedges = target !== null ? wedgeRanges(target) : null;
  const pointerColor = locked ? '#f43f5e' : '#fbbf24';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none"
      style={{
        touchAction: interactive ? 'none' : 'auto',
        aspectRatio: '720 / 404',
        cursor: interactive ? 'pointer' : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* board */}
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
        fill="#1e293b"
        stroke="#334155"
        strokeWidth={3}
      />
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none"
        stroke="#475569"
        strokeWidth={6}
      />
      {/* tick marks */}
      {Array.from({ length: 13 }, (_, i) => i * 15).map((v) => {
        const [x1, y1] = polar(CX, CY, R - 8, v);
        const [x2, y2] = polar(CX, CY, R - (v % 45 === 0 ? 28 : 18), v);
        return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth={2.5} />;
      })}
      {/* target scoring wedges (psychic view / reveal) */}
      {wedges?.map((w, i) => (
        <path
          key={i}
          d={sectorPath(CX, CY, w.from, w.to, 54, R - 4)}
          fill={WEDGE_COLORS[w.points]}
          stroke="#0f172a"
          strokeWidth={2}
          opacity={0.95}
        />
      ))}
      {wedges?.map((w, i) => {
        const [tx, ty] = polar(CX, CY, R - 44, (w.from + w.to) / 2);
        return (
          <text
            key={`label-${i}`}
            x={tx}
            y={ty}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={26}
            fontWeight={700}
            fill="#0f172a"
          >
            {w.points}
          </text>
        );
      })}
      {/* baseline */}
      <line
        x1={CX - R - 8}
        y1={CY}
        x2={CX + R + 8}
        y2={CY}
        stroke="#475569"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* guess markers (party reveal) */}
      {markers?.map((m, i) => {
        const [ix, iy] = polar(CX, CY, 150, m.value);
        const [mx, my] = polar(CX, CY, R + 2, m.value);
        const [lx, ly] = polar(CX, CY, R + 24, m.value);
        return (
          <g key={i}>
            <line x1={ix} y1={iy} x2={mx} y2={my} stroke={m.color} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
            <circle cx={mx} cy={my} r={7} fill={m.color} stroke="#0f172a" strokeWidth={2} />
            <text x={lx} y={ly} textAnchor="middle" fontSize={16} fontWeight={600} fill={m.color}>
              {m.label}
            </text>
          </g>
        );
      })}
      {/* pointer needle */}
      {showPointer && (
        <>
          <line x1={CX} y1={CY} x2={px} y2={py} stroke={pointerColor} strokeWidth={7} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={18} fill="#0f172a" stroke={pointerColor} strokeWidth={4} />
        </>
      )}
    </svg>
  );
}
