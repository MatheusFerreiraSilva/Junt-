/**
 * Utility for client-side image compression to base64 Data URL.
 * Resizes images down to a maximum dimension while maintaining aspect ratio,
 * ensuring fast loading, smooth UI rendering, and small payload in localStorage/Firestore.
 */

export const compressImageFile = (
  file: File,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = err => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
};

export interface GoalPhotoPreset {
  id: string;
  label: string;
  url: string;
  emoji: string;
}

export const GOAL_PHOTO_PRESETS: GoalPhotoPreset[] = [
  {
    id: 'trip',
    label: 'Viagem / Férias',
    url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
    emoji: '✈️',
  },
  {
    id: 'car',
    label: 'Carro Novo',
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
    emoji: '🚗',
  },
  {
    id: 'house',
    label: 'Casa / Apartamento',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
    emoji: '🏡',
  },
  {
    id: 'wedding',
    label: 'Casamento / Festa',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
    emoji: '💍',
  },
  {
    id: 'decor',
    label: 'Reforma & Decoração',
    url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&auto=format&fit=crop&q=80',
    emoji: '🛋️',
  },
  {
    id: 'family',
    label: 'Filhos / Família',
    url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80',
    emoji: '👶',
  },
  {
    id: 'study',
    label: 'Estudos / Especialização',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
    emoji: '🎓',
  },
  {
    id: 'freedom',
    label: 'Liberdade / Reserva',
    url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80',
    emoji: '🏖️',
  },
];
