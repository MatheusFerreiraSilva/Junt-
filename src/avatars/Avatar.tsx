import { useId } from 'react';
import { AVATAR_OPTIONS, normalizeAvatar, type AvatarConfig } from './avatarConfig';
import './avatar.css';

interface AvatarProps {
  config?: AvatarConfig;
  variant?: 'face' | 'body';
  size?: number;
  className?: string;
  label?: string;
}

/** All artwork is local, composable and deterministic. No generated/user SVG is rendered. */
export function Avatar({
  config,
  variant = 'face',
  size = 40,
  className = '',
  label,
}: AvatarProps) {
  const a = normalizeAvatar(config);
  const id = useId().replace(/:/g, '');
  const skin = AVATAR_OPTIONS.skin.find((item) => item.id === a.skin)!.value;
  const hair = AVATAR_OPTIONS.hairColor.find((item) => item.id === a.hairColor)!.value;
  const iris = AVATAR_OPTIONS.eyeColor.find((item) => item.id === a.eyeColor)!.value;
  const outfit = AVATAR_OPTIONS.outfitColor.find((item) => item.id === a.outfitColor)!.value;
  const ink = '#352C35';
  const lip = ['umber', 'espresso'].includes(a.skin) ? '#E0A093' : '#753E43';
  const full = variant === 'body';
  const longHair = ['long', 'bob', 'braids'].includes(a.hair);
  const curls = a.hair === 'curls' || a.hair === 'coils';
  const hairline = a.hair !== 'bald';
  const eyeY = a.eyes === 'bright' ? 78 : 79;
  return (
    <svg
      viewBox={full ? '0 0 200 264' : '25 12 150 150'}
      width={size}
      height={full ? Math.round(size * 1.32) : size}
      className={`junto-avatar-art ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label && <title>{label}</title>}
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={skin} />
          <stop offset="1" stopColor={skin} />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor={outfit} />
          <stop offset="1" stopColor={outfit} />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.25" cy="0.1" r="0.9">
          <stop stopColor="#FFFFFF" stopOpacity=".22" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="junto-avatar-halo" cx="100" cy={full ? 121 : 86} r={full ? 90 : 72} />
      {full && <ellipse cx="100" cy="253" rx="43" ry="5" fill={ink} opacity=".09" />}
      <g className="junto-avatar-figure">
        {full && (
          <g>
            <path
              d="M75 204 71 243Q81 250 91 242L100 210 109 242Q119 250 129 243L125 204Z"
              fill="#49586C"
            />
            <path d="m100 211 0 18" stroke="#303B4C" strokeWidth="2" opacity=".35" />
            <path
              d="M70 240q10 4 21 0l-1 10H66q-2-7 4-10Zm39 0q10 4 21 0 6 3 4 10h-24Z"
              fill="#F4EDE3"
              stroke="#C6BAAD"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M68 154q-10 19-12 42l-3 13q0 8 7 9 6 0 8-8l3-15 9-27Zm64 0q10 19 12 42l3 13q0 8-7 9-6 0-8-8l-3-15-9-27Z"
              fill={skin}
            />
            <path
              d="M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
              fill={`url(#${id}-cloth)`}
              stroke={ink}
              strokeOpacity=".12"
              strokeWidth="1.5"
            />
            <path
              d="M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
              fill={`url(#${id}-shine)`}
            />
            {a.outfit === 'tee' && (
              <path
                d="M87 137q0 19 13 20 13-1 13-20"
                fill={skin}
                stroke={ink}
                strokeOpacity=".12"
                strokeWidth="2"
              />
            )}
            {a.outfit === 'hoodie' && (
              <>
                <path d="M83 140q-5 19 17 25 22-6 17-25-17-18-34 0Z" fill={ink} opacity=".16" />
                <path
                  d="m84 143 16 19 16-19"
                  fill="none"
                  stroke="#FFF"
                  strokeOpacity=".6"
                  strokeWidth="3"
                />
                <path
                  d="M89 164v20m22-20v20"
                  stroke="#F7F0E6"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M85 191h30l4 12H81Z" fill={ink} opacity=".12" />
              </>
            )}
            {a.outfit === 'shirt' && (
              <>
                <path d="m85 137 15 15 15-15 5 10-13 13-7-8-7 8-13-13Z" fill="#FFF" opacity=".8" />
                <path d="M100 157v55" stroke={ink} strokeWidth="1.5" opacity=".2" />
                {[170, 185, 200].map((y) => (
                  <circle key={y} cx="105" cy={y} r="1.5" fill="#F9F2E6" />
                ))}
              </>
            )}
            {a.outfit === 'cardigan' && (
              <>
                <path d="m86 137 14 27 14-27v78H86Z" fill="#F4EBDD" />
                <path
                  d="m84 139 12 26v50m20-76-12 26v50"
                  fill="none"
                  stroke={ink}
                  strokeOpacity=".15"
                  strokeWidth="3"
                />
                <path d="M82 189H91M109 189h9" stroke={ink} strokeOpacity=".18" strokeWidth="2" />
              </>
            )}
            <path
              d="M77 181v20m46-20v20"
              stroke={ink}
              strokeOpacity=".12"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}
        <g className="junto-avatar-head">
          {a.hair === 'bun' && <circle cx="100" cy="27" r="21" fill={hair} />}
          {longHair && (
            <path d="M53 65q-1-44 47-44 47 0 47 44l7 68q-13 15-28 2H74q-20 9-28-2Z" fill={hair} />
          )}
          {a.hair === 'coils' && <ellipse cx="100" cy="59" rx="57" ry="45" fill={hair} />}
          <path d="M88 115v27q12 13 24 0v-27" fill={skin} />
          <path d="M88 119q12 9 24 0v10q-12 7-24 0Z" fill={ink} opacity=".1" />
          <ellipse cx="57" cy="86" rx="9" ry="12" fill={skin} />
          <ellipse cx="143" cy="86" rx="9" ry="12" fill={skin} />
          <path
            d="M59 83q-5-4-5 3m87-3q5-4 5 3"
            stroke={ink}
            strokeOpacity=".15"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M59 64q0-36 41-36t41 36v27q-2 36-41 43-39-7-41-43Z" fill={`url(#${id}-skin)`} />
          <path d="M59 64q0-36 41-36t41 36v27q-2 36-41 43-39-7-41-43Z" fill={`url(#${id}-shine)`} />
          <ellipse cx="73" cy="98" rx="9" ry="5" fill="#D4787F" opacity=".24" />
          <ellipse cx="127" cy="98" rx="9" ry="5" fill="#D4787F" opacity=".24" />
          {a.accessory === 'beard' && (
            <path
              d="M62 97q8 14 17 12l10-5q11 8 22 0l10 5q9 2 17-12-2 30-38 36-36-6-38-36Z"
              fill={hair}
              opacity=".88"
            />
          )}
          <path
            d="M73 68q8-4 16 0m22 0q8-4 16 0"
            fill="none"
            stroke={hair}
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".85"
          />
          {[81, 119].map((x) => (
            <g key={x}>
              {a.eyes === 'happy' ? (
                <path
                  d={`M${x - 6} 81q6-8 12 0`}
                  fill="none"
                  stroke={ink}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <ellipse
                    cx={x}
                    cy={eyeY}
                    rx={a.eyes === 'almond' ? 8 : 6.5}
                    ry={a.eyes === 'bright' ? 8.5 : a.eyes === 'almond' ? 5 : 7}
                    fill="#FFFDF8"
                  />
                  <ellipse
                    cx={x}
                    cy={eyeY + 0.5}
                    rx={a.eyes === 'bright' ? 4.8 : 4}
                    ry={a.eyes === 'bright' ? 6.5 : 5}
                    fill={iris}
                  />
                  <ellipse cx={x} cy={eyeY + 1} rx="2" ry="3" fill="#252331" />
                  <circle cx={x - 1.4} cy={eyeY - 1.8} r="1.4" fill="white" />
                  <path
                    d={`M${x - 7} ${eyeY - 2}q7-7 14 0`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </>
              )}
            </g>
          ))}
          <path
            d="m100 86-3 10q3 3 6 0"
            fill="none"
            stroke={ink}
            strokeOpacity=".25"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {a.mouth === 'smile' && (
            <path
              d="M90 109q10 11 20 0"
              fill="none"
              stroke={lip}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          )}
          {a.mouth === 'calm' && (
            <path
              d="M93 111q7 3 14 0"
              fill="none"
              stroke="#753E43"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
          {a.mouth === 'grin' && (
            <>
              <path d="M88 107q12 5 24 0-1 15-12 15-11 0-12-15Z" fill="#753E43" />
              <path d="M91 110h18q-9 6-18 0Z" fill="#FFFDF6" />
            </>
          )}
          {a.mouth === 'joy' && (
            <>
              <ellipse cx="100" cy="113" rx="8" ry="9" fill="#753E43" />
              <path d="M94 117q6-5 12 0" stroke="#D78A8C" strokeWidth="4" strokeLinecap="round" />
            </>
          )}
          {a.accessory === 'freckles' &&
            [69, 75, 81, 119, 125, 131].map((x, i) => (
              <circle key={x} cx={x} cy={96 + (i % 2) * 4} r="1.2" fill={ink} opacity=".38" />
            ))}
          {hairline && !curls && (
            <>
              {a.hair === 'crop' && (
                <path d="M57 76V58q0-34 43-34t43 34v17l-9-23q-34 11-66 0Z" fill={hair} />
              )}
              {a.hair === 'sweep' && (
                <path
                  d="M56 77V54q3-33 49-33 35 0 40 29l-9 26-3-25q-22 15-55 10l-13-6Z"
                  fill={hair}
                />
              )}
              {a.hair === 'waves' && (
                <path
                  d="M55 78q-10-15 0-31 0-15 20-17 11-18 30-10 22-4 30 13 17 5 12 25l-6 21-9-24q-6 10-20 4-13 10-28 1-10 4-17-4Z"
                  fill={hair}
                />
              )}
              {a.hair === 'bob' && (
                <path
                  d="M54 89V59q0-37 46-37t46 37v31l-13-33q-11-5-17-17-8 20-48 20l-3 29Z"
                  fill={hair}
                />
              )}
              {a.hair === 'long' && (
                <path
                  d="M54 94V58q0-36 46-36t46 36v36l-13-38q-24-3-36-19-5 20-31 26l-2 31Z"
                  fill={hair}
                />
              )}
              {a.hair === 'bun' && (
                <path
                  d="M55 81V60q0-36 45-36t45 36v21l-13-25q-17-3-32-17-15 14-32 17Z"
                  fill={hair}
                />
              )}
              {a.hair === 'braids' && (
                <>
                  <path
                    d="M55 83V57q0-34 45-34t45 34v26l-14-27q-17-2-31-18-13 16-31 18Z"
                    fill={hair}
                  />
                  {[57, 143].map((x) => (
                    <g key={x}>
                      {[84, 94, 104, 114, 124, 134].map((y, i) => (
                        <ellipse
                          key={y}
                          cx={x + (i % 2 ? 2 : -2)}
                          cy={y}
                          rx="7"
                          ry="8"
                          fill={hair}
                        />
                      ))}
                      <path d={`M${x - 5} 140h10`} stroke="#C3A05E" strokeWidth="3" />
                    </g>
                  ))}
                </>
              )}
            </>
          )}
          {curls && (
            <>
              <path d="M56 81V56q2-34 44-34 42 0 44 34v25l-13-26q-31 9-62 0Z" fill={hair} />
              {(a.hair === 'coils'
                ? [
                    [55, 52],
                    [63, 34],
                    [80, 26],
                    [100, 22],
                    [120, 26],
                    [137, 34],
                    [145, 52],
                    [77, 49],
                    [97, 44],
                    [117, 48],
                  ]
                : [
                    [61, 49],
                    [73, 33],
                    [92, 29],
                    [113, 30],
                    [132, 41],
                    [140, 58],
                    [82, 48],
                    [106, 46],
                  ]
              ).map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={a.hair === 'coils' ? 12 : 13} fill={hair} />
                  <path
                    d={`M${x - 4} ${y - 4}q7-5 10 2`}
                    stroke="#FFFFFF"
                    strokeOpacity=".08"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </>
          )}
          {(a.accessory === 'round' || a.accessory === 'square') && (
            <g fill="none" stroke={ink} strokeWidth="2.5">
              {a.accessory === 'round' ? (
                <>
                  <circle cx="81" cy="81" r="13" />
                  <circle cx="119" cy="81" r="13" />
                </>
              ) : (
                <>
                  <rect x="66" y="70" width="29" height="22" rx="6" />
                  <rect x="105" y="70" width="29" height="22" rx="6" />
                </>
              )}
              <path d="M95 79q5-4 10 0M59 76l8 2m66 0 8-2" />
            </g>
          )}
          {a.accessory === 'earrings' && (
            <g fill="none" stroke="#D7AD60" strokeWidth="3">
              <ellipse cx="55" cy="98" rx="5" ry="7" />
              <ellipse cx="145" cy="98" rx="5" ry="7" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
