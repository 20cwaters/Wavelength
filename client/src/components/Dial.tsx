import { useRef } from 'react';
import { DIAL_MAX, DIAL_MIN } from '../../../shared/constants';
import { wedgeRanges } from '../../../shared/game';
import { polar, sectorPath } from '../dialMath';

const W = 720;
const H = 440;
const CX = 360;
const CY = 404;
const R = 330;

const WEDGE_FILL: Record<number, string> = {
  4: 'url(#wedge4)',
  3: 'url(#wedge3)',
  2: 'url(#wedge2)',
};

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
  /** Extra labeled needles — live guesses / party-mode reveal. */
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

  const wedges = target !== null ? wedgeRanges(target) : null;

  // Tapered needle polygon: wide at the hub, near-point at the tip.
  const rad = ((180 - value) * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const nx = -uy; // perpendicular
  const ny = ux;
  const bx = CX + 14 * ux;
  const by = CY + 14 * uy;
  const tx = CX + (R + 2) * ux;
  const ty = CY + (R + 2) * uy;
  const needlePoints = [
    [bx + 7 * nx, by + 7 * ny],
    [tx + 1.8 * nx, ty + 1.8 * ny],
    [tx - 1.8 * nx, ty - 1.8 * ny],
    [bx - 7 * nx, by - 7 * ny],
  ]
    .map((p) => p.join(','))
    .join(' ');
  const hubColor = locked ? '#e11d48' : '#f59e0b';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none"
      style={{
        touchAction: interactive ? 'none' : 'auto',
        aspectRatio: `${W} / ${H}`,
        cursor: interactive ? 'grab' : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <radialGradient id="dialFace" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R}>
          <stop offset="0%" stopColor="#2a3650" />
          <stop offset="55%" stopColor="#1d2639" />
          <stop offset="100%" stopColor="#151c2c" />
        </radialGradient>
        <linearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b6b84" />
          <stop offset="100%" stopColor="#2c3648" />
        </linearGradient>
        <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={locked ? '#fecdd3' : '#fde68a'} />
          <stop offset="100%" stopColor={locked ? '#e11d48' : '#f59e0b'} />
        </linearGradient>
        <radialGradient id="wedge4" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R}>
          <stop offset="25%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="wedge3" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R}>
          <stop offset="25%" stopColor="#115e59" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </radialGradient>
        <radialGradient id="wedge2" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R}>
          <stop offset="25%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#60a5fa" />
        </radialGradient>
        <filter id="needleShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        <filter id="markerShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* face */}
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`} fill="url(#dialFace)" />

      {/* faint machined arcs */}
      {[130, 200, 268].map((r) => (
        <path
          key={r}
          d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.04}
          strokeWidth={1.5}
        />
      ))}

      {/* tick marks: fine every 5°, bold every 15° */}
      {Array.from({ length: 37 }, (_, i) => i * 5).map((v) => {
        const major = v % 15 === 0;
        const [x1, y1] = polar(CX, CY, R - 12, v);
        const [x2, y2] = polar(CX, CY, R - (major ? 32 : 22), v);
        return (
          <line
            key={v}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={major ? '#64748b' : '#475569'}
            strokeWidth={major ? 2.5 : 1.4}
            strokeOpacity={major ? 0.9 : 0.55}
            strokeLinecap="round"
          />
        );
      })}

      {/* target scoring wedges */}
      {wedges && (
        <g className="dial-wedges">
          <path d={sectorPath(CX, CY, wedges[0].from, wedges[4].to, 46, R - 2)} fill="#ffffff" opacity={0.05} />
          {wedges.map((w, i) => (
            <path
              key={i}
              d={sectorPath(CX, CY, w.from, w.to, 50, R - 6)}
              fill={WEDGE_FILL[w.points]}
              stroke="#0b1220"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ))}
          {wedges.map((w, i) => {
            const [lx, ly] = polar(CX, CY, R - 42, (w.from + w.to) / 2);
            return (
              <text
                key={`label-${i}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={25}
                fontWeight={800}
                fill="#0b1220"
                opacity={0.85}
              >
                {w.points}
              </text>
            );
          })}
        </g>
      )}

      {/* rim */}
      <path
        d={`M ${CX - (R + 4)} ${CY} A ${R + 4} ${R + 4} 0 0 1 ${CX + (R + 4)} ${CY}`}
        fill="none"
        stroke="url(#rimGrad)"
        strokeWidth={12}
      />
      <path
        d={`M ${CX - (R + 11)} ${CY} A ${R + 11} ${R + 11} 0 0 1 ${CX + (R + 11)} ${CY}`}
        fill="none"
        stroke="#0b1220"
        strokeWidth={2.5}
        strokeOpacity={0.8}
      />

      {/* labeled guess markers (live view / reveal) */}
      {markers?.map((m, i) => {
        const [ix, iy] = polar(CX, CY, 180, m.value);
        const [mx, my] = polar(CX, CY, R - 2, m.value);
        const [dotx, doty] = polar(CX, CY, R + 4, m.value);
        const labelR = R + 30 + (i % 2) * 26; // stagger neighbors so pills don't collide
        const pillW = m.label.length * 8.5 + 18;
        let [lx, ly] = polar(CX, CY, labelR, m.value);
        lx = Math.min(W - pillW / 2 - 4, Math.max(pillW / 2 + 4, lx));
        ly = Math.max(16, ly);
        return (
          <g key={i}>
            <line
              x1={ix}
              y1={iy}
              x2={mx}
              y2={my}
              stroke={m.color}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.95}
              filter="url(#markerShadow)"
            />
            <circle cx={dotx} cy={doty} r={7} fill={m.color} stroke="#0b1220" strokeWidth={2} />
            <rect
              x={lx - pillW / 2}
              y={ly - 12}
              width={pillW}
              height={24}
              rx={12}
              fill="#0b1220"
              opacity={0.92}
              stroke={m.color}
              strokeWidth={1.5}
            />
            <text
              x={lx}
              y={ly + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13.5}
              fontWeight={700}
              fill={m.color}
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {/* baseline */}
      <line
        x1={CX - R - 16}
        y1={CY}
        x2={CX + R + 16}
        y2={CY}
        stroke="url(#rimGrad)"
        strokeWidth={9}
        strokeLinecap="round"
      />

      {/* needle + hub */}
      {showPointer && (
        <g filter="url(#needleShadow)">
          <polygon points={needlePoints} fill="url(#needleGrad)" />
          <circle cx={CX} cy={CY} r={21} fill="#0d1523" stroke="url(#rimGrad)" strokeWidth={3.5} />
          <circle cx={CX} cy={CY} r={8} fill={hubColor} />
          <circle cx={CX - 3} cy={CY - 3} r={2.4} fill="#ffffff" opacity={0.5} />
        </g>
      )}
    </svg>
  );
}
