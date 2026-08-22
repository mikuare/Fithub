const MAX_UPLOAD_BYTES = 25_000_000;
const MAX_STORED_CHARACTERS = 700_000;
const AVATAR_SIZE = 384;
const IMAGE_FILE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|jfif|jpe|jpeg|jpg|png|webp)$/i;

type ProfileImageCandidate = Pick<File, 'size' | 'type'> & { name?: string };

/** Returns user-facing validation copy, or null when the file is acceptable. */
export function profileImageProblem(file: ProfileImageCandidate): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return 'That photo is over 25 MB. Choose a smaller image.';

  // Files chosen from iCloud, Google Photos and some Android galleries can
  // arrive with no MIME type (or application/octet-stream) even when they are
  // ordinary .jpg files. The browser still verifies the content by decoding it
  // below, so a recognised extension is a safe fallback for those pickers.
  const imageMime = file.type.toLowerCase().startsWith('image/');
  const imageName = typeof file.name === 'string' && IMAGE_FILE_EXTENSION.test(file.name.trim());
  if (!imageMime && !imageName) {
    return 'Choose an image file: JPG, JPEG, PNG, WebP, AVIF, GIF, BMP, HEIC or HEIF.';
  }
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
      image.onerror = () => reject(new Error('This image could not be opened. Try a JPG, JPEG, PNG, WebP or another image supported by your phone.'));
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
