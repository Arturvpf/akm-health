import type { EnvironmentId } from './environment-data';

/** Decorative schematic of the selected mission setting. Not to scale, no scientific imagery. */
const PLANETS: Record<EnvironmentId, { fill: string; rim: string; label: string }> = {
  mars_surface: { fill: '#b5482a', rim: '#ff9a6b', label: 'Mars' },
  lunar_surface: { fill: '#8e949e', rim: '#e4e8f0', label: 'the Moon' },
  iss_microgravity: { fill: '#2c64c4', rim: '#7fc4ff', label: 'low Earth orbit' },
  earth_analog: { fill: '#2f8a6e', rim: '#8ff0c8', label: 'an Earth analog' },
};

export function PlanetScene({ environment }: { environment: EnvironmentId }) {
  const planet = PLANETS[environment];
  return (
    <svg className="planet-scene" viewBox="0 0 520 520" role="img"
      aria-label={`Schematic of ${planet.label} with the ODYSSEY-26 habitat marker and an orbiting relay. Not to scale.`}>
      <defs>
        <radialGradient id="planet-shade" cx="34%" cy="30%" r="78%">
          <stop offset="0" stopColor="#fff" stopOpacity=".26" />
          <stop offset=".55" stopColor="#000" stopOpacity=".1" />
          <stop offset="1" stopColor="#000" stopOpacity=".72" />
        </radialGradient>
        <radialGradient id="planet-halo" cx="50%" cy="50%" r="50%">
          <stop offset=".62" stopColor={planet.rim} stopOpacity=".28" />
          <stop offset="1" stopColor={planet.rim} stopOpacity="0" />
        </radialGradient>
        <clipPath id="planet-disc"><circle cx="260" cy="260" r="124" /></clipPath>
      </defs>
      <g className="planet-rings" fill="none" strokeWidth="1">
        <circle cx="260" cy="260" r="236" />
        <circle cx="260" cy="260" r="184" strokeDasharray="3 7" />
      </g>
      <circle cx="260" cy="260" r="170" fill="url(#planet-halo)" />
      <circle className="planet-body" cx="260" cy="260" r="124" fill={planet.fill} />
      <g clipPath="url(#planet-disc)">
        <ellipse cx="212" cy="214" rx="48" ry="22" fill="#000" opacity=".17" />
        <ellipse cx="304" cy="306" rx="64" ry="26" fill="#000" opacity=".15" />
        <ellipse cx="304" cy="204" rx="32" ry="14" fill="#fff" opacity=".11" />
        <ellipse cx="204" cy="316" rx="36" ry="12" fill="#fff" opacity=".09" />
        <circle cx="336" cy="252" r="14" fill="none" stroke="#000" opacity=".28" strokeWidth="2" />
        <circle cx="186" cy="264" r="9" fill="none" stroke="#000" opacity=".28" strokeWidth="2" />
      </g>
      <circle cx="260" cy="260" r="124" fill="url(#planet-shade)" />
      <circle cx="260" cy="260" r="124" fill="none" stroke={planet.rim} strokeOpacity=".5" strokeWidth="1.5" />
      <circle className="planet-ping" cx="300" cy="224" r="5" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="300" cy="224" r="4" fill="#fff" />
      <path d="M304 220 L352 174 H426" stroke="#c9d3e8" strokeWidth="1" fill="none" />
      <text x="352" y="166" fill="#f4f7fc" fontSize="12" letterSpacing="1.2">HAB-01</text>
      <g className="planet-orbit">
        <circle cx="260" cy="24" r="6" fill="#fc3d21" />
        <circle cx="260" cy="24" r="12" fill="none" stroke="#fc3d21" strokeWidth="1" opacity=".6" />
      </g>
    </svg>
  );
}
