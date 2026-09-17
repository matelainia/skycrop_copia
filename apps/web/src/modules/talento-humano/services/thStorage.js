import { supabase } from '../../../lib/supabaseClient';
import { getActiveOrgId } from '../../../lib/supabaseClient';

const dataUrlToBlob = (dataUrl) => {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext: (mime.split('/')[1] || 'jpg').split('+')[0] };
};

/**
 * Sube un dataURL al bucket tenant (`{companyId}/...`).
 * Si el storage no está disponible (056 sin aplicar), devuelve null y el
 * llamador conserva el valor en columna (compatibilidad de transición).
 */
export const uploadDataUrl = async (bucket, folder, filename, dataUrl) => {
  if (!dataUrl || !String(dataUrl).startsWith('data:')) return dataUrl || null;
  const orgId = getActiveOrgId();
  if (!orgId) return null;
  try {
    const { blob, ext } = dataUrlToBlob(dataUrl);
    const path = `${orgId}/${folder}/${filename}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn(`Storage ${bucket} no disponible, se conserva valor en columna:`, err?.message || err);
    return null;
  }
};

export const uploadFotoTrabajador = (identificacion, dataUrl) =>
  uploadDataUrl('trabajadores', 'fotos', `${identificacion || 'sin-id'}-${Date.now()}`, dataUrl);

export const uploadCertificado = (trabajadorId, dataUrl) =>
  uploadDataUrl('certificados', `${trabajadorId || 'sin-id'}`, `cert-${Date.now()}`, dataUrl);
