/**
 * soilAnalysisStorage.service.js
 * Gestión de PDFs en Supabase Storage (bucket privado analisis-suelos)
 * Path: {company_id}/{predio_id}/{analysis_id}/{fileName}
 * Acceso vía Signed URL temporal (5-15 min)
 */
import { supabase } from '../../../lib/supabaseClient.js';

const BUCKET = 'analisis-suelos';
const SIGNED_URL_TTL_SECONDS = 600; // 10 minutos

function buildStoragePath(companyId, predioId, analysisId, fileName) {
  const safeName = (fileName || 'informe.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  // Estructura: {company_id}/{predio_id}/{analysis_id}/{file}
  // predio_id puede ser null -> usar 'sin-predio'
  const predioSegment = predioId ? String(predioId) : 'sin-predio';
  return `${companyId}/${predioSegment}/${analysisId}/${safeName}`;
}

export const soilAnalysisStorageService = {
  /**
   * Sube un PDF al bucket privado
   * @param {File} file - File object (PDF)
   * @param {{ companyId:string, predioId:string|null, analysisId:string }} ctx
   * @param {(progress:number)=>void} [onProgress]
   * @returns {Promise<{ path:string, fileName:string, size:number, mime:string }>}
   */
  async uploadPdf(file, { companyId, predioId, analysisId }, onProgress) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!file) throw new Error('Archivo requerido.');
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Solo se permiten archivos PDF.');
    }
    const MAX_MB = 15;
    if (file.size > MAX_MB * 1024 * 1024) {
      throw new Error(`El archivo excede el límite de ${MAX_MB} MB.`);
    }
    if (!companyId || !analysisId) throw new Error('companyId y analysisId son requeridos.');

    const path = buildStoragePath(companyId, predioId, analysisId, file.name);

    // Supabase storage upload
    // Nota: onProgress no es soportado nativamente; simulamos estados si caller lo necesita
    onProgress?.(10);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      });

    onProgress?.(90);

    if (error) {
      if (/permission|RLS|policy|not allowed|JWT/i.test(error.message)) {
        throw new Error('No tienes permisos para subir archivos en esta empresa.');
      }
      throw new Error(error.message);
    }

    onProgress?.(100);

    return {
      path,
      fileName: file.name,
      size: file.size,
      mime: file.type || 'application/pdf',
    };
  },

  /**
   * Genera Signed URL temporal para visualizar/descargar PDF
   * @param {string} path - storage_path guardado en BD
   * @param {number} [ttlSeconds]
   * @returns {Promise<string>} signed URL
   */
  async getSignedUrl(path, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!path) throw new Error('Path del archivo requerido.');

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, ttlSeconds);

    if (error) throw new Error(error.message);
    if (!data?.signedUrl) throw new Error('No se pudo generar la URL firmada.');
    return data.signedUrl;
  },

  /**
   * Descarga directa del PDF (usa signed URL + fetch blob)
   * @param {string} path
   * @param {string} fileName
   */
  async downloadPdf(path, fileName = 'analisis.pdf') {
    const url = await this.getSignedUrl(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error('No fue posible descargar el archivo.');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
  },

  /**
   * Elimina el PDF del storage (cuando se archiva/anula análisis)
   * @param {string} path
   */
  async deletePdf(path) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!path) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message);
  },

  /**
   * Lista archivos de un análisis (por si hay múltiples versiones)
   * @param {string} companyId
   * @param {string} predioId
   * @param {string} analysisId
   */
  async listPdfs(companyId, predioId, analysisId) {
    if (!supabase) return [];
    const prefix = `${companyId}/${predioId || 'sin-predio'}/${analysisId}`;
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix);
    if (error) return [];
    return data || [];
  }
};
