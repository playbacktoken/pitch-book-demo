import React from "react";

const W = 457;
const H = 754;

// Pixel boxes [x1, y1, x2, y2] on /sitemap.png
const FACILITY_BOX = {
  back_pitch: [88, 45, 393, 227],
  training_pitch: [281, 257, 430, 465],
  main_pitch: [55, 341, 238, 630],
  astro: [268, 472, 340, 624],
  juvenile_pitch: [344, 477, 457, 700],
};

const PART_BOX = {
  astro_cage_3: [268, 472, 340, 523],
  astro_cage_2: [268, 523, 340, 573],
  astro_cage_1: [268, 573, 340, 624],
  main_top_half: [55, 485, 238, 630],
  main_second_half: [55, 341, 238, 485],
  back_stafford: [88, 45, 240, 227],
  back_boland: [240, 45, 393, 227],
};

const style = ([x1, y1, x2, y2]) => ({
  left: `${(x1 / W) * 100}%`,
  top: `${(y1 / H) * 100}%`,
  width: `${((x2 - x1) / W) * 100}%`,
  height: `${((y2 - y1) / H) * 100}%`,
});

export const SiteMap = ({ facilities = [], activeId, partId, onSelect, className = "" }) => {
  const box = PART_BOX[partId] || FACILITY_BOX[activeId];
  const names = Object.fromEntries(facilities.map((f) => [f.id, f.name]));
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-[#0b0f17] ${className}`} data-testid="site-map">
      <img src="/sitemap.png" alt="Walterstown GFC grounds map" className="block w-full h-auto select-none" draggable={false} />
      {onSelect &&
        Object.entries(FACILITY_BOX)
          .filter(([id]) => names[id])
          .map(([id, b]) => (
            <button
              key={id}
              type="button"
              title={`Book ${names[id]}`}
              aria-label={`Book ${names[id]}`}
              data-testid={`site-map-${id}`}
              onClick={() => onSelect(id)}
              className={`absolute rounded-sm transition-colors ${
                id === activeId ? "bg-emerald-400/30 ring-2 ring-emerald-300" : "hover:bg-white/20"
              }`}
              style={style(b)}
            />
          ))}
      {!onSelect && box && (
        <div
          className="absolute rounded-sm bg-emerald-400/35 ring-2 ring-emerald-300 pointer-events-none transition-all duration-300"
          style={style(box)}
          data-testid="site-map-highlight"
        />
      )}
    </div>
  );
};
