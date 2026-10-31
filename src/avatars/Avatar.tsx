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

/** All artwork is local, composable and deterministic vector SVG. No external assets or user HTML. */
export function Avatar({
  config,
  variant = 'face',
  size = 40,
  className = '',
  label,
}: AvatarProps) {
  const a = normalizeAvatar(config);
  const id = useId().replace(/:/g, '');
  const skin = AVATAR_OPTIONS.skin.find((item) => item.id === a.skin)?.value ?? '#D9A171';
  const hair = AVATAR_OPTIONS.hairColor.find((item) => item.id === a.hairColor)?.value ?? '#583C30';
  const iris = AVATAR_OPTIONS.eyeColor.find((item) => item.id === a.eyeColor)?.value ?? '#51382D';
  const outfit = AVATAR_OPTIONS.outfitColor.find((item) => item.id === a.outfitColor)?.value ?? '#2C7A6E';
  const ink = '#27232C';
  const lip = ['umber', 'espresso'].includes(a.skin) ? '#E0A093' : '#753E43';
  const full = variant === 'body';
  const isMasculine = a.gender === 'masculine';
  const longHair = ['long', 'bob', 'braids', 'ponytail'].includes(a.hair);
  const curls = a.hair === 'curls' || a.hair === 'coils';
  const hairline = a.hair !== 'bald';
  const eyeY = a.eyes === 'bright' ? 78 : 79;

  return (
    <svg
      viewBox={full ? '0 0 200 268' : '25 12 150 150'}
      width={size}
      height={full ? Math.round(size * 1.34) : size}
      className={`junto-avatar-art ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label && <title>{label}</title>}
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={skin} />
          <stop offset="100%" stopColor={skin} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={outfit} />
          <stop offset="100%" stopColor={outfit} stopOpacity="0.88" />
        </linearGradient>
        <linearGradient id={`${id}-labcoat`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
        <linearGradient id={`${id}-pedestal`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#EDE6DA" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#DFD6C6" stopOpacity="0.92" />
        </linearGradient>
        <radialGradient id={`${id}-pedestal-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#EDE6DA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shine`} cx="0.25" cy="0.1" r="0.9">
          <stop stopColor="#FFFFFF" stopOpacity=".22" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>

      {/* Atmospheric Stage Halo */}
      <circle className="junto-avatar-halo" cx="100" cy={full ? 122 : 86} r={full ? 90 : 72} />

      {/* 3D Pedestal Floor Stage in full view */}
      {full && (
        <g className="junto-avatar-stage">
          {/* Floor contact shadow */}
          <ellipse cx="100" cy="257" rx="58" ry="9" fill={ink} opacity=".16" />
          {/* Architectural Podium Base */}
          <ellipse cx="100" cy="254" rx="52" ry="7.5" fill={`url(#${id}-pedestal)`} stroke="#CFC5B4" strokeWidth="1" />
          <ellipse cx="100" cy="253" rx="46" ry="6" fill={`url(#${id}-pedestal-glow)`} />
        </g>
      )}

      <g className="junto-avatar-figure">
        {full && (
          <g>
            {/* Pants / Leg Silhouette */}
            <path
              d={isMasculine
                ? "M72 203 68 243Q79 250 89 242L100 209 111 242Q121 250 132 243L128 203Z"
                : "M75 204 71 243Q81 250 91 242L100 210 109 242Q119 250 129 243L125 204Z"
              }
              fill={a.outfit === 'scrub' ? outfit : '#374151'}
            />
            <path d="m100 210 0 20" stroke={ink} strokeWidth="1.5" opacity=".3" />

            {/* Clean Medical Sneakers / Clogs with Grip Soles */}
            <path
              d="M67 240q10 4 22 0l-1 11H63q-2-7 4-11Zm43 0q10 4 22 0 6 3 4 11h-25Z"
              fill="#F9FAFB"
              stroke="#D1D5DB"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M72 244h12m25 0h12" stroke="#9CA3AF" strokeWidth="1" strokeLinecap="round" />

            {/* Forearms / Hands (Natural Skin) */}
            <path
              d={isMasculine
                ? "M64 153q-11 19-13 43l-3 13q0 8 7 9 6 0 8-8l3-15 10-28Zm72 0q11 19 13 43l3 13q0 8-7 9-6 0-8-8l-3-15-10-28Z"
                : "M68 154q-10 19-12 42l-3 13q0 8 7 9 6 0 8-8l3-15 9-27Zm64 0q10 19 12 42l3 13q0 8-7 9-6 0-8-8l-3-15-9-27Z"
              }
              fill={skin}
            />

            {/* ========================================================= */}
            {/* COMPLETE STANDALONE OUTFITS (No generic colored base!)    */}
            {/* ========================================================= */}

            {/* 1. JALECO BRANCO MÉDICO (White Doctor's Coat - Fully Distinct Outfit) */}
            {a.outfit === 'labcoat' && (
              <g className="junto-avatar-labcoat">
                {/* Full Lab Coat Sleeves */}
                <path
                  d="M64 153q-11 19-13 41l14 3 4-23 5-21Z"
                  fill={`url(#${id}-labcoat)`}
                  stroke="#CBD5E1"
                  strokeWidth="1.2"
                />
                <path
                  d="M136 153q11 19 13 41l-14 3-4-23-5-21Z"
                  fill={`url(#${id}-labcoat)`}
                  stroke="#CBD5E1"
                  strokeWidth="1.2"
                />
                <path d="M54 193l11 3m81-3l-11 3" stroke="#94A3B8" strokeWidth="1.2" />

                {/* Inner Medical Scrub / Shirt visible through center V */}
                <path
                  d={isMasculine
                    ? "M75 142q25-10 50 0l-3 44q-22 8-44 0Z"
                    : "M77 143q23-9 46 0l-3 44q-20 8-40 0Z"
                  }
                  fill={`url(#${id}-cloth)`}
                />
                <path d="M85 137 100 162 115 137" fill={skin} stroke={ink} strokeWidth="1.5" strokeOpacity=".2" />

                {/* Main White Coat Body */}
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 34q-29 11-58 0l3-34-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 34q-26 11-52 0l3-34-17-7Z"
                  }
                  fill={`url(#${id}-labcoat)`}
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                />

                {/* Center Coat Lapels and Placket */}
                {/* Left Lapel */}
                <path
                  d="M84 138l14 26-10 16h6l8-22-8-20Z"
                  fill="#FFFFFF"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                />
                {/* Right Lapel */}
                <path
                  d="M116 138l-14 26 10 16h-6l-8-22 8-20Z"
                  fill="#FFFFFF"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                />

                {/* Coat center vertical opening */}
                <path d="M100 178v38" stroke="#CBD5E1" strokeWidth="1.6" />

                {/* Pearlescent White Buttons */}
                {[182, 194, 206].map((y) => (
                  <circle key={y} cx="100" cy={y} r="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
                ))}

                {/* Left Chest Pocket with Hospital ID Badge and Pen */}
                <rect x="114" y="165" width="16" height="18" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M123 159v10" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="123" cy="158" r="1.5" fill="#EF4444" />

                {/* Hospital Badge on Right Chest */}
                <path d="M78 158v8" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                <rect x="73" y="166" width="12" height="15" rx="1.5" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
                <rect x="75" y="168" width="8" height="6" rx="1" fill="#0284C7" opacity=".7" />
                <path d="M75 177h8" stroke="#94A3B8" strokeWidth="1" />

                {/* Lower Left and Right Coat Pockets */}
                <rect x="71" y="188" width="16" height="18" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
                <rect x="113" y="188" width="16" height="18" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              </g>
            )}

            {/* 2. SCRUB MÉDICO (Pijama Cirúrgico Hospitalar) */}
            {a.outfit === 'scrub' && (
              <g className="junto-avatar-scrub">
                {/* Torso Base in scrub color */}
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-shine)`}
                />

                {/* Scrub Sleeves */}
                <path d="M64 153q-8 12-10 24l13 2 4-15 5-11Z" fill={`url(#${id}-cloth)`} />
                <path d="M136 153q8 12 10 24l-13 2-4-15-5-11Z" fill={`url(#${id}-cloth)`} />
                <path d="M54 177l12 2m80-2l-12 2" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity=".3" />

                {/* V-Neck Scrub Collar */}
                <path d="M85 137 100 162 115 137" fill={skin} stroke={ink} strokeWidth="1.6" strokeOpacity=".2" />
                <path d="M84 137l16 26 16-26" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity=".35" />

                {/* Scrub Chest Pocket with Pen & Badge */}
                <rect x="114" y="164" width="16" height="18" rx="2" fill={outfit} stroke={ink} strokeWidth="1.2" strokeOpacity=".25" />
                <path d="M119 160v10" stroke="#F1F5F9" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="119" cy="159" r="1.5" fill="#38BDF8" />

                {/* ID Badge on other side */}
                <rect x="73" y="166" width="10" height="14" rx="1.5" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
                <path d="M75 170h6m-6 3h4" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
                <circle cx="78" cy="164" r="1.5" fill="#EF4444" />

                {/* Side split seams */}
                <path d="M75 198v10m50-10v10" stroke={ink} strokeWidth="1.5" strokeOpacity=".2" />
              </g>
            )}

            {/* 3. CAMISETA CASUAL PREMIUM */}
            {a.outfit === 'tee' && (
              <g className="junto-avatar-tee">
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-shine)`}
                />
                {/* Clean Crewneck Ribbed Collar */}
                <path
                  d="M87 137q0 19 13 20 13-1 13-20"
                  fill={skin}
                  stroke={ink}
                  strokeOpacity=".2"
                  strokeWidth="2"
                />
                <path
                  d="M86 137q0 21 14 22 14-1 14-22"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity=".3"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* 4. CAMISA SOCIAL DE ALFAIATARIA */}
            {a.outfit === 'shirt' && (
              <g className="junto-avatar-shirt">
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                {/* Crisp Pointed Dress Collar */}
                <path d="m85 137 15 15 15-15 5 10-13 13-7-8-7 8-13-13Z" fill="#FFF" opacity=".92" stroke="#CBD5E1" strokeWidth="1" />
                {/* Vertical Placket */}
                <path d="M100 157v55" stroke="#FFFFFF" strokeWidth="2.5" opacity=".6" />
                <path d="M100 157v55" stroke={ink} strokeWidth="1" opacity=".18" />
                {[168, 182, 196, 206].map((y) => (
                  <circle key={y} cx="100" cy={y} r="1.8" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
                ))}
              </g>
            )}

            {/* 5. MOLETOM COM CAPUZ (Hoodie com cordões) */}
            {a.outfit === 'hoodie' && (
              <g className="junto-avatar-hoodie">
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                {/* Thick Hood Collar Fold */}
                <path d="M82 138q-6 18 18 23 24-5 18-23-18-12-36 0Z" fill={ink} opacity=".18" />
                <path d="m82 141 18 20 18-20" fill="none" stroke="#FFF" strokeOpacity=".5" strokeWidth="3.5" />
                {/* Hanging Drawstrings with Capped Aglets */}
                <path d="M91 161v22m18-22v22" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
                <rect x="90" y="180" width="2" height="4" fill="#94A3B8" rx="0.5" />
                <rect x="108" y="180" width="2" height="4" fill="#94A3B8" rx="0.5" />
                {/* Kangaroo Pocket */}
                <path d="M82 186h36l5 16H77Z" fill={ink} opacity=".12" stroke={ink} strokeOpacity=".15" strokeWidth="1" />
              </g>
            )}

            {/* 6. BLAZER / CARDIGÃ EXECUTIVO */}
            {a.outfit === 'cardigan' && (
              <g className="junto-avatar-blazer">
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                {/* Inner Crisp White Shirt */}
                <path d="m86 137 14 30 14-30v72H86Z" fill="#FFFFFF" />
                <path d="m84 139 12 28v48m20-76-12 28v48" fill="none" stroke={ink} strokeOpacity=".2" strokeWidth="2.5" />
                {/* Button & Pocket welt */}
                <circle cx="100" cy="184" r="2.2" fill="#334155" />
                <path d="M80 188h12M108 188h12" stroke={ink} strokeOpacity=".2" strokeWidth="1.8" />
              </g>
            )}

            {/* 7. JAQUETA MODERNA COM ZÍPER */}
            {a.outfit === 'jacket' && (
              <g className="junto-avatar-jacket">
                <path
                  d={isMasculine
                    ? "M71 141q29-14 58 0l15 34-17 7 3 30q-29 11-58 0l3-30-17-7Z"
                    : "M74 142q26-13 52 0l14 33-17 7 3 30q-26 11-52 0l3-30-17-7Z"
                  }
                  fill={`url(#${id}-cloth)`}
                  stroke={ink}
                  strokeOpacity=".14"
                  strokeWidth="1.5"
                />
                {/* Inner dark t-shirt */}
                <path d="M88 137 100 156 112 137v70H88Z" fill="#1F2937" opacity=".85" />
                {/* Metallic Center Zipper */}
                <path d="M100 156v54" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="3 2" />
                {/* Zipper Pull Tab */}
                <rect x="98.5" y="162" width="3" height="6" rx="1" fill="#94A3B8" />
                {/* Angled pocket zips */}
                <path d="M78 188l8 8m36-8l-8 8" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            )}

            {/* ========================================================= */}
            {/* BODY ACCESSORIES (Stethoscope, Backpack, Bag, Soccer)     */}
            {/* ========================================================= */}

            {/* ESTETOSCÓPIO MÉDICO LITTMANN STYLE NO PESCOÇO */}
            {a.accessory === 'stethoscope' && (
              <g className="junto-avatar-stethoscope">
                {/* Thick Dual-Lumen Flexible Tubing */}
                <path
                  d="M82 134 Q76 156 86 174 T100 186 Q108 186 114 176 T118 134"
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                <path
                  d="M82 134 Q76 156 86 174 T100 186 Q108 186 114 176 T118 134"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.8"
                  strokeOpacity=".65"
                  strokeLinecap="round"
                />
                {/* Chrome Binaural Tubes near Neckline */}
                <path d="M82 134l-3-6m39 6l3-6" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
                {/* Stainless Steel Dual-Head Chestpiece (Bell & Diaphragm) */}
                <circle cx="100" cy="188" r="8" fill="url(#metal)" stroke="#334155" strokeWidth="2" />
                <circle cx="100" cy="188" r="5" fill="#475569" />
                <circle cx="98.5" cy="186.5" r="1.8" fill="#FFFFFF" opacity=".8" />
              </g>
            )}

            {/* FONE DE OUVIDO OVER-EAR NO PESCOÇO */}
            {a.accessory === 'headphones' && (
              <g className="junto-avatar-headphones">
                {/* Arched Headband behind collar */}
                <path
                  d="M74 130 C72 150 128 150 126 130"
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M74 130 C72 150 128 150 126 130"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeOpacity=".8"
                />
                {/* Cushioned Oval Ear Pads with Accent Rings */}
                <rect x="67" y="124" width="12" height="19" rx="5.5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
                <rect x="121" y="124" width="12" height="19" rx="5.5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
                <circle cx="73" cy="133.5" r="2.8" fill="#3B82F6" />
                <circle cx="127" cy="133.5" r="2.8" fill="#3B82F6" />
              </g>
            )}

            {/* MOCHILA DE PLANTÃO / RESIDÊNCIA */}
            {a.accessory === 'backpack' && (
              <g className="junto-avatar-backpack">
                <path d="M73 140v60m54-60v60" stroke="#1E293B" strokeWidth="6.5" strokeLinecap="round" />
                <path d="M73 140v60m54-60v60" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4" />
                {/* Sternum Chest Buckle Clip */}
                <path d="M73 174h54" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                <rect x="96" y="172" width="8" height="5" rx="1.5" fill="#94A3B8" />
              </g>
            )}

            {/* BOLSA LATERAL / PASTA TRANSVERSAL */}
            {a.accessory === 'bag' && (
              <g className="junto-avatar-bag">
                <path d="M72 142 L138 214" stroke="#9A3412" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M125 200 h24 v24 q0 6 -6 6 h-12 q-6 0 -6 -6 Z" fill="#C2410C" stroke="#7C2D12" strokeWidth="1.5" />
                <circle cx="137" cy="208" r="2.5" fill="#FED7AA" />
              </g>
            )}

            {/* BOLA DE FUTEBOL 3D NO CHÃO */}
            {a.accessory === 'soccer' && (
              <g className="junto-avatar-soccer">
                <ellipse cx="148" cy="254" rx="15" ry="4" fill={ink} opacity=".25" />
                <circle cx="148" cy="242" r="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
                <polygon points="148,236 153,240 151,245 145,245 143,240" fill="#0F172A" />
                <path d="M148 236v-4m5 8l4 2m-2 7l3 3m-9 0l-3 3m-4-7l-4 2" stroke="#1E293B" strokeWidth="1.2" />
                <ellipse cx="144" cy="236" rx="4" ry="2" fill="#FFFFFF" opacity=".6" />
              </g>
            )}
          </g>
        )}

        {/* ========================================================= */}
        {/* PORTRAIT BUST COLLAR IN FACE MODE (No floating head!)     */}
        {/* ========================================================= */}
        {!full && (
          <g className="junto-avatar-portrait-bust">
            {/* Shoulders base */}
            <path
              d={isMasculine
                ? "M54 140q46-12 92 0l16 26H38Z"
                : "M58 141q42-11 84 0l15 25H43Z"
              }
              fill={a.outfit === 'labcoat' ? '#FFFFFF' : `url(#${id}-cloth)`}
              stroke={a.outfit === 'labcoat' ? '#CBD5E1' : ink}
              strokeWidth="1.5"
              strokeOpacity={a.outfit === 'labcoat' ? 1 : 0.15}
            />

            {/* Lab Coat Bust Detailing in Face Mode */}
            {a.outfit === 'labcoat' && (
              <>
                {/* Inner scrub collar */}
                <path d="M85 137 100 160 115 137" fill={`url(#${id}-cloth)`} />
                {/* White Lapels */}
                <path d="M84 138l12 24-8 10h6l8-18-8-16Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                <path d="M116 138l-12 24 8 10h-6l-8-18 8-16Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
                {/* Pocket pen */}
                <path d="M124 152v8" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}

            {/* Scrub Bust Detailing */}
            {a.outfit === 'scrub' && (
              <path d="M84 137l16 25 16-25" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity=".4" />
            )}

            {/* Hoodie Bust Detailing */}
            {a.outfit === 'hoodie' && (
              <>
                <path d="m82 141 18 19 18-19" fill="none" stroke="#FFF" strokeOpacity=".5" strokeWidth="3" />
                <path d="M92 158v8m16-8v8" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              </>
            )}

            {/* Shirt Bust Detailing */}
            {a.outfit === 'shirt' && (
              <path d="m85 137 15 14 15-14 5 8-15 12-15-12Z" fill="#FFF" stroke="#CBD5E1" strokeWidth="1" />
            )}

            {/* Stethoscope in Face Mode */}
            {a.accessory === 'stethoscope' && (
              <g>
                <path
                  d="M82 134 Q76 156 86 166 T100 172 Q108 172 114 166 T118 134"
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M82 134 Q76 156 86 166 T100 172 Q108 172 114 166 T118 134"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeOpacity=".65"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="168" r="6" fill="url(#metal)" stroke="#334155" strokeWidth="1.5" />
              </g>
            )}

            {/* Headphones in Face Mode */}
            {a.accessory === 'headphones' && (
              <g>
                <rect x="67" y="128" width="12" height="18" rx="5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
                <rect x="121" y="128" width="12" height="18" rx="5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
                <circle cx="73" cy="137" r="2.5" fill="#3B82F6" />
                <circle cx="127" cy="137" r="2.5" fill="#3B82F6" />
              </g>
            )}
          </g>
        )}

        {/* ========================================================= */}
        {/* HEAD, FACE, HAIR & FACIAL ACCESSORIES                     */}
        {/* ========================================================= */}
        <g className="junto-avatar-head">
          {/* Hair back volume */}
          {a.hair === 'bun' && <circle cx="100" cy="25" r="24" fill={hair} />}
          {a.hair === 'ponytail' && (
            <path d="M100 35 C132 30 156 55 152 95 C146 95 138 80 135 65 Z" fill={hair} />
          )}
          {longHair && (
            <path
              d={a.hair === 'ponytail'
                ? "M54 65q-1-44 46-44 46 0 46 44l4 40q-12 12-25 2H75q-18 8-25-2Z"
                : "M52 64q-1-45 48-45 48 0 48 45l8 72q-14 16-30 2H74q-22 10-30-2Z"
              }
              fill={hair}
            />
          )}
          {a.hair === 'coils' && <ellipse cx="100" cy="57" rx="60" ry="48" fill={hair} />}

          {/* Neck with realistic anatomy */}
          <path d="M88 115v27q12 13 24 0v-27" fill={skin} />
          <path d="M88 119q12 9 24 0v10q-12 7-24 0Z" fill={ink} opacity=".12" />

          {/* Ears with inner detail */}
          <ellipse cx="57" cy="86" rx="9" ry="12" fill={skin} />
          <ellipse cx="143" cy="86" rx="9" ry="12" fill={skin} />
          <path d="M59 83q-5-4-5 3m87-3q5-4 5 3" stroke={ink} strokeOpacity=".2" fill="none" strokeWidth="2" strokeLinecap="round" />

          {/* Head & Face Contour */}
          <path
            d={isMasculine
              ? "M58 64q0-37 42-37t42 37v28q-3 38-42 45-39-7-42-45Z"
              : "M59 64q0-36 41-36t41 36v27q-2 36-41 43-39-7-41-43Z"
            }
            fill={`url(#${id}-skin)`}
          />
          <path
            d={isMasculine
              ? "M58 64q0-37 42-37t42 37v28q-3 38-42 45-39-7-42-45Z"
              : "M59 64q0-36 41-36t41 36v27q-2 36-41 43-39-7-41-43Z"
            }
            fill={`url(#${id}-shine)`}
          />

          {/* Rosy Cheek Blush */}
          <ellipse cx="73" cy="98" rx="10" ry="5.5" fill="#D4787F" opacity=".28" />
          <ellipse cx="127" cy="98" rx="10" ry="5.5" fill="#D4787F" opacity=".28" />

          {/* Aligned Modern Beard / Cavanhaque */}
          {a.accessory === 'beard' && (
            <path
              d="M60 96q9 16 18 13l10-4q12 8 24 0l10 4q9 3 18-13-3 32-40 38-38-6-40-38Z"
              fill={hair}
              opacity=".92"
            />
          )}

          {/* Eyebrows */}
          <path
            d={isMasculine
              ? "M71 67q9-5 18 0m20 0q9-5 18 0"
              : "M73 68q8-4 16 0m22 0q8-4 16 0"
            }
            fill="none"
            stroke={hair}
            strokeWidth={isMasculine ? "3.6" : "3"}
            strokeLinecap="round"
            opacity=".92"
          />

          {/* Expressive Eyes with Depth & Specular Catchlights */}
          {[81, 119].map((x) => (
            <g key={x}>
              {a.eyes === 'happy' ? (
                <path d={`M${x - 6} 81q6-8 12 0`} fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
              ) : (
                <>
                  <ellipse
                    cx={x}
                    cy={eyeY}
                    rx={a.eyes === 'almond' ? 8.2 : 7}
                    ry={a.eyes === 'bright' ? 8.8 : a.eyes === 'almond' ? 5.2 : 7.2}
                    fill="#FFFDF8"
                  />
                  <ellipse
                    cx={x}
                    cy={eyeY + 0.5}
                    rx={a.eyes === 'bright' ? 5.2 : 4.4}
                    ry={a.eyes === 'bright' ? 7 : 5.4}
                    fill={iris}
                  />
                  <ellipse cx={x} cy={eyeY + 1} rx="2.4" ry="3.2" fill="#18181B" />
                  <circle cx={x - 1.5} cy={eyeY - 1.8} r="1.6" fill="white" />
                  <circle cx={x + 1.8} cy={eyeY + 1.2} r="0.9" fill="white" opacity=".85" />
                  <path d={`M${x - 7} ${eyeY - 2.2}q7-7 14 0`} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </g>
          ))}

          {/* Nose */}
          <path
            d="m100 85-3 11q3 3 6 0"
            fill="none"
            stroke={ink}
            strokeOpacity=".26"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Mouth Expressions */}
          {a.mouth === 'smile' && (
            <path d="M89 109q11 11 22 0" fill="none" stroke={lip} strokeWidth="3" strokeLinecap="round" />
          )}
          {a.mouth === 'calm' && (
            <path d="M92 111q8 3 16 0" fill="none" stroke={lip} strokeWidth="2.6" strokeLinecap="round" />
          )}
          {a.mouth === 'grin' && (
            <>
              <path d="M87 107q13 5 26 0-1 15-13 15-12 0-13-15Z" fill="#753E43" />
              <path d="M90 110h20q-10 6-20 0Z" fill="#FFFDF6" />
            </>
          )}
          {a.mouth === 'joy' && (
            <>
              <ellipse cx="100" cy="113" rx="8.5" ry="9.5" fill="#753E43" />
              <path d="M93 117q7-5 14 0" stroke="#D78A8C" strokeWidth="4.2" strokeLinecap="round" />
            </>
          )}

          {/* Natural Freckles */}
          {a.accessory === 'freckles' &&
            [69, 74, 80, 120, 126, 131].map((x, i) => (
              <circle key={x} cx={x} cy={95 + (i % 2) * 4} r="1.3" fill={ink} opacity=".4" />
            ))}

          {/* --- HAIRSTYLES --- */}
          {hairline && !curls && (
            <>
              {/* Short Classic */}
              {a.hair === 'crop' && (
                <path d="M57 76V56q0-35 43-35t43 35v19l-10-24q-33 11-66 0Z" fill={hair} />
              )}
              {/* Tapered Fade */}
              {a.hair === 'fade' && (
                <>
                  <path d="M58 68V54q0-33 42-33t42 33v14l-8-18q-34 9-68 0Z" fill={hair} />
                  <path d="M57 68h5v12h-5Zm81 0h5v12h-5Z" fill={hair} opacity=".4" />
                </>
              )}
              {/* Modern Quiff / Topete */}
              {a.hair === 'quiff' && (
                <path
                  d="M57 75V54q3-38 48-38 25 0 38 16 12 15-4 28l-8-22q-32 9-54 0l-10 16Z"
                  fill={hair}
                />
              )}
              {/* Side Sweep */}
              {a.hair === 'sweep' && (
                <path
                  d="M56 77V54q3-33 49-33 35 0 40 29l-9 26-3-25q-22 15-55 10l-13-6Z"
                  fill={hair}
                />
              )}
              {/* Waves with texture */}
              {a.hair === 'waves' && (
                <path
                  d="M55 78q-10-15 0-31 0-15 20-17 11-18 30-10 22-4 30 13 17 5 12 25l-6 21-9-24q-6 10-20 4-13 10-28 1-10 4-17-4Z"
                  fill={hair}
                />
              )}
              {/* Bob */}
              {a.hair === 'bob' && (
                <path
                  d="M54 89V59q0-37 46-37t46 37v31l-13-33q-11-5-17-17-8 20-48 20l-3 29Z"
                  fill={hair}
                />
              )}
              {/* Long Hair */}
              {a.hair === 'long' && (
                <path
                  d="M54 94V58q0-36 46-36t46 36v36l-13-38q-24-3-36-19-5 20-31 26l-2 31Z"
                  fill={hair}
                />
              )}
              {/* Ponytail */}
              {a.hair === 'ponytail' && (
                <>
                  <path
                    d="M56 80V58q0-36 44-36t44 36v22l-12-25q-16-3-32-17-16 14-32 17Z"
                    fill={hair}
                  />
                  <circle cx="100" cy="36" r="6" fill="#3B82F6" />
                </>
              )}
              {/* Bun */}
              {a.hair === 'bun' && (
                <path
                  d="M55 81V60q0-36 45-36t45 36v21l-13-25q-17-3-32-17-15 14-32 17Z"
                  fill={hair}
                />
              )}
              {/* Braids */}
              {a.hair === 'braids' && (
                <>
                  <path d="M55 83V57q0-34 45-34t45 34v26l-14-27q-17-2-31-18-13 16-31 18Z" fill={hair} />
                  {[57, 143].map((x) => (
                    <g key={x}>
                      {[84, 94, 104, 114, 124, 134].map((y, i) => (
                        <ellipse key={y} cx={x + (i % 2 ? 2 : -2)} cy={y} rx="7" ry="8" fill={hair} />
                      ))}
                      <path d={`M${x - 5} 140h10`} stroke="#D7AD60" strokeWidth="3" />
                    </g>
                  ))}
                </>
              )}
            </>
          )}

          {/* Curls and Coils */}
          {curls && (
            <>
              <path d="M56 81V56q2-34 44-34 42 0 44 34v25l-13-26q-31 9-62 0Z" fill={hair} />
              {(a.hair === 'coils'
                ? [
                    [55, 52], [63, 34], [80, 26], [100, 22], [120, 26],
                    [137, 34], [145, 52], [77, 49], [97, 44], [117, 48],
                  ]
                : [
                    [61, 49], [73, 33], [92, 29], [113, 30], [132, 41],
                    [140, 58], [82, 48], [106, 46],
                  ]
              ).map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={a.hair === 'coils' ? 12 : 13} fill={hair} />
                  <path d={`M${x - 4} ${y - 4}q7-5 10 2`} stroke="#FFFFFF" strokeOpacity=".12" fill="none" strokeWidth="2" strokeLinecap="round" />
                </g>
              ))}
            </>
          )}

          {/* Eyewear Accessories */}
          {(a.accessory === 'round' || a.accessory === 'square') && (
            <g fill="none" stroke={ink} strokeWidth="2.6">
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
              <path d="M94 79q6-4 12 0M58 76l9 2m66 0 9-2" />
            </g>
          )}

          {/* Sunglasses */}
          {a.accessory === 'sunglasses' && (
            <g>
              <path d="M66 70h30v16q0 8-15 8t-15-8Zm38 0h30v16q0 8-15 8t-15-8Z" fill="#18181B" stroke="#09090B" strokeWidth="2" />
              <path d="M96 73h8m-38 3l14 12m24-12l14 12" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity=".3" strokeLinecap="round" />
            </g>
          )}

          {/* Golden Hoop Earrings */}
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
