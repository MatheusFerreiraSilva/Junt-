/** A compact, versioned recipe. Never store raw SVG or user-provided markup. */
export const AVATAR_OPTIONS = {
  skin: [
    { id: 'porcelain', label: 'Porcelana', value: '#F6D8C4' },
    { id: 'peach', label: 'Pêssego', value: '#EFC2A2' },
    { id: 'honey', label: 'Mel', value: '#D9A171' },
    { id: 'caramel', label: 'Caramelo', value: '#BE8058' },
    { id: 'cocoa', label: 'Cacau', value: '#935E42' },
    { id: 'umber', label: 'Âmbar escuro', value: '#70452F' },
    { id: 'espresso', label: 'Café', value: '#4B3026' },
  ],
  hairColor: [
    { id: 'ink', label: 'Preto', value: '#27252A' },
    { id: 'brown', label: 'Castanho', value: '#583C30' },
    { id: 'chestnut', label: 'Castanho claro', value: '#88563A' },
    { id: 'copper', label: 'Ruivo', value: '#B9683F' },
    { id: 'gold', label: 'Loiro', value: '#D2AE68' },
    { id: 'silver', label: 'Prateado', value: '#B6B5B8' },
    { id: 'rose', label: 'Rosa', value: '#B96682' },
    { id: 'violet', label: 'Violeta', value: '#76638C' },
  ],
  hair: [
    { id: 'crop', label: 'Curto' },
    { id: 'sweep', label: 'De lado' },
    { id: 'waves', label: 'Ondulado' },
    { id: 'curls', label: 'Cacheado' },
    { id: 'coils', label: 'Crespo' },
    { id: 'bob', label: 'Chanel' },
    { id: 'long', label: 'Longo' },
    { id: 'bun', label: 'Coque' },
    { id: 'braids', label: 'Tranças' },
    { id: 'bald', label: 'Sem cabelo' },
  ],
  eyeColor: [
    { id: 'brown', label: 'Castanhos', value: '#51382D' },
    { id: 'dark', label: 'Escuros', value: '#292731' },
    { id: 'hazel', label: 'Mel', value: '#8D6D3E' },
    { id: 'green', label: 'Verdes', value: '#56765D' },
    { id: 'blue', label: 'Azuis', value: '#577E98' },
  ],
  eyes: [
    { id: 'soft', label: 'Suaves' },
    { id: 'almond', label: 'Amendoados' },
    { id: 'bright', label: 'Expressivos' },
    { id: 'happy', label: 'Sorridentes' },
  ],
  mouth: [
    { id: 'smile', label: 'Sorriso' },
    { id: 'grin', label: 'Sorriso aberto' },
    { id: 'calm', label: 'Tranquila' },
    { id: 'joy', label: 'Alegria' },
  ],
  outfit: [
    { id: 'tee', label: 'Camiseta' },
    { id: 'shirt', label: 'Camisa' },
    { id: 'hoodie', label: 'Moletom' },
    { id: 'cardigan', label: 'Cardigã' },
  ],
  outfitColor: [
    { id: 'sage', label: 'Sálvia', value: '#719784' },
    { id: 'teal', label: 'Petróleo', value: '#3D797D' },
    { id: 'blue', label: 'Azul', value: '#688AAF' },
    { id: 'lilac', label: 'Lilás', value: '#9C8AB9' },
    { id: 'rose', label: 'Rosé', value: '#C48590' },
    { id: 'clay', label: 'Terracota', value: '#BD8065' },
    { id: 'ochre', label: 'Mostarda', value: '#C3A05E' },
    { id: 'charcoal', label: 'Grafite', value: '#535A68' },
    { id: 'cream', label: 'Areia', value: '#CFBEA5' },
  ],
  accessory: [
    { id: 'none', label: 'Sem acessório' },
    { id: 'round', label: 'Óculos redondos' },
    { id: 'square', label: 'Óculos retangulares' },
    { id: 'earrings', label: 'Brincos' },
    { id: 'freckles', label: 'Sardas' },
    { id: 'beard', label: 'Barba' },
  ],
} as const;

export type AvatarFeature = keyof typeof AVATAR_OPTIONS;
export type AvatarConfig = { version: 1 } & {
  [K in AvatarFeature]: (typeof AVATAR_OPTIONS)[K][number]['id'];
};
export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  skin: 'honey',
  hairColor: 'brown',
  hair: 'waves',
  eyeColor: 'brown',
  eyes: 'soft',
  mouth: 'smile',
  outfit: 'tee',
  outfitColor: 'sage',
  accessory: 'none',
};
const FEATURES = Object.keys(AVATAR_OPTIONS) as AvatarFeature[];
/** Unknown versions fall back completely; old/partial recipes fall back per feature. */
export function normalizeAvatar(input: unknown): AvatarConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...DEFAULT_AVATAR };
  const data = input as Record<string, unknown>;
  if (data.version !== undefined && data.version !== 1) return { ...DEFAULT_AVATAR };
  const safe = { ...DEFAULT_AVATAR };
  for (const feature of FEATURES) {
    const option = AVATAR_OPTIONS[feature].find((item) => item.id === data[feature]);
    if (option) Object.assign(safe, { [feature]: option.id });
  }
  return safe;
}
export function isAvatarConfig(input: unknown): input is AvatarConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const data = input as Record<string, unknown>;
  return (
    data.version === 1 &&
    Object.keys(data).length === FEATURES.length + 1 &&
    Object.keys(data).every(
      (key) => key === 'version' || FEATURES.includes(key as AvatarFeature)
    ) &&
    FEATURES.every((feature) =>
      AVATAR_OPTIONS[feature].some((option) => option.id === data[feature])
    )
  );
}
export function randomAvatar(): AvatarConfig {
  const recipe = { ...DEFAULT_AVATAR };
  if (!globalThis.crypto?.getRandomValues) return recipe;
  const values = globalThis.crypto.getRandomValues(new Uint32Array(FEATURES.length));
  FEATURES.forEach((feature, index) => {
    const options = AVATAR_OPTIONS[feature];
    Object.assign(recipe, { [feature]: options[values[index] % options.length].id });
  });
  return recipe;
}
