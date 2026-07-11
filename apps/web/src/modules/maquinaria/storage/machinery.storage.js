import { supabase } from '../../../lib/supabaseClient';

/**
 * Adapter Storage Manager for Machinery photos and documents
 */
export class MachineryStorage {
  constructor() {
    this.bucketName = 'maquinaria';
  }

  /**
   * Upload an image file to Supabase Storage
   * @param {File} file - Browser file object
   * @returns {Promise<string>} Public URL of the uploaded image
   */
  async uploadPhoto(file) {
    if (!file) throw new Error('No se ha suministrado ningún archivo.');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `machinery/${fileName}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error in storage adapter:', uploadError.message);
      throw new Error(`Error de almacenamiento: ${uploadError.message}`);
    }

    // Retrieve public URL
    const { data: publicUrlData } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error('Error al obtener la URL pública de la foto subida.');
    }

    return publicUrlData.publicUrl;
  }

  /**
   * Delete a file from storage by its filepath or URL
   */
  async deleteFile(filePathOrUrl) {
    let filePath = filePathOrUrl;
    
    // Extract path from full URL if necessary
    if (filePathOrUrl.includes('/public/')) {
      const parts = filePathOrUrl.split('/public/');
      if (parts[1]) {
        // Remove bucket prefix
        const subParts = parts[1].split('/');
        subParts.shift(); // remove bucket name
        filePath = subParts.join('/');
      }
    }

    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Delete error in storage adapter:', error.message);
      throw error;
    }

    return true;
  }
}

export const machineryStorage = new MachineryStorage();
export default machineryStorage;
