const MAX_UPLOAD_BYTES = 10_000_000;
const MAX_STORED_CHARACTERS = 700_000;
const AVATAR_SIZE = 384;

/** Returns user-facing validation copy, or null when the file is acceptable. */
export function profileImageProblem(file: Pick<File, 'size' | 'type'>): string | null {
  if (!file.type.startsWith('image/')) return 'Choose an image file such as JPG, PNG or WebP.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That photo is over 10 MB. Choose a smaller image.';
  return null;
}

/**
 * Crops a profile photo to a square and compresses it before persistence.
 * Keeping the result small makes local reloads fast and avoids storing a
 * multi-megabyte phone photo in every profile query.
 */
export async function prepareProfileImage(file: File): Promise<string> {
  const problem = profileImageProblem(file);
  if (problem) throw new Error(problem);

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image format could not be opened. Try JPG, PNG or WebP.'));
      image.src = url;
    });

    if (!image.naturalWidth || !image.naturalHeight) throw new Error('That image has no usable dimensions.');

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not prepare the photo.');

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('This browser could not compress the photo.');
    if (dataUrl.length > MAX_STORED_CHARACTERS) throw new Error('The prepared photo is still too large. Try a smaller image.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
