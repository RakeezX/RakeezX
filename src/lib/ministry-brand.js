/** The uploaded Ministry mark stays an unchanged, same-origin asset. */
export const MINISTRY_LOGO_URL = new URL('../../assets/brand/ministry-of-education.png', import.meta.url).href;

let logo = null;
let pending = null;

export const getMinistryLogo = () => logo;

/** Share one decoded image across report and certificate previews. Fail visibly. */
export function loadMinistryLogo() {
  if (logo) return Promise.resolve(logo);
  if (pending) return pending;
  if (typeof Image === 'undefined') return Promise.reject(new Error('Image decoding is unavailable'));
  pending = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try {
        await image.decode?.();
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ministry logo is empty');
        logo = image;
        image.onload = image.onerror = null;
        resolve(image);
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error('Ministry logo could not be loaded'));
    image.src = MINISTRY_LOGO_URL;
  }).catch(error => {
    pending = null;
    throw error;
  });
  return pending;
}
