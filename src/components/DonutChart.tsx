import React, { useState } from 'react';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  sublabel?: string;
  categoryKey?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  centerValue?: number | string;
  formatter?: (val: number) => string;
  className?: string;
  onSliceSelect?: (slice: DonutSlice | null) => void;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 230,
  thickness = 40,
  centerTitle,
  centerSubtitle,
  centerValue,
  formatter = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  className = '',
  onSliceSelect,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  if (total <= 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-slate-400 ${className}`}>
        <div
          className="rounded-full border-4 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center animate-pulse"
          style={{ width: size, height: size }}
        >
          <span className="text-xs font-semibold text-slate-500">Sem dados cadastrados</span>
        </div>
      </div>
    );
  }

  const center = size / 2;
  const outerRadius = size / 2 - 12;
  const innerRadius = Math.max(12, outerRadius - thickness);

  let accumulatedAngle = 0;

  const slices = data.map((item, index) => {
    const value = Math.max(0, item.value);
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angle = total > 0 ? (value / total) * 360 : 0;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    // Handle full circle case (360 deg)
    let pathData = '';
    if (angle >= 359.99) {
      const rOuter = outerRadius;
      const rInner = innerRadius;
      pathData = `
        M ${center} ${center - rOuter}
        A ${rOuter} ${rOuter} 0 1 1 ${center} ${center + rOuter}
        A ${rOuter} ${rOuter} 0 1 1 ${center} ${center - rOuter}
        M ${center} ${center - rInner}
        A ${rInner} ${rInner} 0 1 0 ${center} ${center + rInner}
        A ${rInner} ${rInner} 0 1 0 ${center} ${center - rInner}
      `;
    } else {
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);

      const x1Outer = center + outerRadius * Math.cos(startRad);
      const y1Outer = center + outerRadius * Math.sin(startRad);
      const x2Outer = center + outerRadius * Math.cos(endRad);
      const y2Outer = center + outerRadius * Math.sin(endRad);

      const x1Inner = center + innerRadius * Math.cos(endRad);
      const y1Inner = center + innerRadius * Math.sin(endRad);
      const x2Inner = center + innerRadius * Math.cos(startRad);
      const y2Inner = center + innerRadius * Math.sin(startRad);

      const largeArcFlag = angle <= 180 ? 0 : 1;

      pathData = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}`,
        `Z`,
      ].join(' ');
    }

    return {
      ...item,
      percentage,
      pathData,
      index,
    };
  });

  const activeIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
  const activeSlice = activeIndex !== null ? slices[activeIndex] : null;

  const handleSliceClick = (index: number) => {
    setSelectedIndex((prev) => {
      const next = prev === index ? null : index;
      if (onSliceSelect) {
        onSliceSelect(next !== null ? slices[next] : null);
      }
      return next;
    });
  };

  const displayDefaultValue =
    centerValue !== undefined
      ? typeof centerValue === 'number'
        ? formatter(centerValue)
        : centerValue
      : formatter(total);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Svg Donut Canvas with fluid entrance & click animation */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in fade-in zoom-in-90"
        >
          <defs>
            <filter id="donutShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.25" />
            </filter>
            <filter id="activeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ffffff" floodOpacity="0.4" />
            </filter>
          </defs>

          {slices.map((slice) => {
            const isHovered = hoveredIndex === slice.index;
            const isSelected = selectedIndex === slice.index;
            const isActive = isHovered || isSelected;

            return (
              <g
                key={slice.index}
                className="cursor-pointer outline-none focus:outline-none"
                onClick={() => handleSliceClick(slice.index)}
                role="button"
                tabIndex={0}
                aria-label={`${slice.label}: ${formatter(slice.value)} (${slice.percentage.toFixed(1)}%)`}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSliceClick(slice.index)}
              >
                <path
                  d={slice.pathData}
                  fill={slice.color}
                  filter={isActive ? 'url(#donutShadow)' : undefined}
                  className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-center active:scale-95 ${
                    isActive
                      ? 'scale-106 opacity-100 stroke-white dark:stroke-slate-900 stroke-2'
                      : 'opacity-90 hover:opacity-100 hover:scale-103'
                  }`}
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                  }}
                  onMouseEnter={() => setHoveredIndex(slice.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onTouchStart={() => setHoveredIndex(slice.index)}
                />
              </g>
            );
          })}
        </svg>

        {/* Center overlay info (responsive cross-fade transition) */}
        <div
          onClick={() => {
            if (selectedIndex !== null) {
              setSelectedIndex(null);
              if (onSliceSelect) onSliceSelect(null);
            }
          }}
          className={`absolute inset-0 flex flex-col items-center justify-center text-center p-3 rounded-full cursor-pointer transition-all duration-300 ${
            selectedIndex !== null ? 'hover:bg-slate-100/40 dark:hover:bg-slate-800/40' : ''
          }`}
          style={{ width: innerRadius * 1.68, height: innerRadius * 1.68, margin: 'auto' }}
          title={selectedIndex !== null ? 'Clique para ver o total' : undefined}
        >
          {activeSlice ? (
            <div className="animate-in fade-in zoom-in-95 duration-200 space-y-0.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mb-0.5 shadow-sm"
                style={{ backgroundColor: activeSlice.color }}
              />
              <div className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                {activeSlice.label}
              </div>
              <div
                className="text-xs sm:text-sm font-black tabular-nums transition-colors"
                style={{ color: activeSlice.color }}
              >
                {formatter(activeSlice.value)}
              </div>
              <div className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tabular-nums">
                {activeSlice.percentage.toFixed(1)}% do total
              </div>
              {selectedIndex !== null && (
                <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 underline pt-0.5">
                  redefinir
                </div>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in duration-300 space-y-0.5">
              <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {centerTitle || 'Total'}
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {displayDefaultValue}
              </div>
              {centerSubtitle && (
                <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                  {centerSubtitle}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Legend with click-to-highlight synchronization */}
      <div className="grid grid-cols-2 gap-2 mt-4 w-full px-1">
        {slices.map((slice) => {
          const isSelected = selectedIndex === slice.index;
          const isHovered = hoveredIndex === slice.index;
          const isActive = isSelected || isHovered;

          return (
            <button
              type="button"
              key={slice.index}
              onClick={() => handleSliceClick(slice.index)}
              onMouseEnter={() => setHoveredIndex(slice.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all duration-200 active:scale-95 text-left border ${
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-xs'
                  : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-1">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 shadow-xs transition-transform duration-200 ${
                    isActive ? 'scale-125 ring-2 ring-white dark:ring-slate-900' : ''
                  }`}
                  style={{ backgroundColor: slice.color }}
                />
                <span
                  className={`truncate text-[11px] font-bold ${
                    isActive ? 'text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                  title={slice.label}
                >
                  {slice.label}
                </span>
              </div>
              <div className="text-right shrink-0 font-mono text-[11px] tabular-nums">
                <span className="font-extrabold">{formatter(slice.value)}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                  ({slice.percentage.toFixed(0)}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
