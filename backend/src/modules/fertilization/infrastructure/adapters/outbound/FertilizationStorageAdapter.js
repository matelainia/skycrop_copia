/**
 * FertilizationStorageAdapter.js
 * Adaptador de salida: gestión de archivos adjuntos en Supabase Storage.
 * Bucket: 'fertilization-attachments'
 * Path: {companyId}/observations/{observationId}/{filename}
 */
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { ExternalApiError } from '../../../../../shared/errors/AppErrors.js';

const BUCKET = 'fertilization-attachments';

export class FertilizationStorageAdapter {
  /**
   * Sube un archivo al bucket de Storage.
   * @param {string} companyId
   * @param {string} observationId
   * @param {Buffer} fileBuffer
   * @param {string} fileName
   * @param {string} [mimeType]
   * @returns {Promise<string>} filePath en Storage
   */
  async uploadAttachment(companyId, observationId, fileBuffer, fileName, mimeType) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${companyId}/observations/${observationId}/${Date.now()}_${sanitizedName}`;

    try {
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false
      });

      if (error) throw error;
      return filePath;
    } catch (err) {
      throw new ExternalApiError(`Error subiendo adjunto ${fileName}`, 'Supabase Storage', err);
    }
  }

  /**
   * Genera una URL firmada para acceder a un archivo (válida 1 hora).
   * @param {string} filePath
   * @returns {Promise<string>} URL firmada
   */
  async getSignedUrl(filePath) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600); // 1 hora

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      throw new ExternalApiError(
        `Error generando URL firmada para ${filePath}`,
        'Supabase Storage',
        err
      );
    }
  }

  /**
   * Elimina un archivo del bucket.
   * @param {string} filePath
   */
  async deleteAttachment(filePath) {
    try {
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove([filePath]);

      if (error) throw error;
    } catch (err) {
      console.warn('[FertilizationStorage] Error eliminando adjunto:', err.message);
    }
  }
}
