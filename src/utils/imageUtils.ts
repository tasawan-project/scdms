/**
 * Image processing utilities for student photos and general media
 * Handles client-side compression to optimize Firestore database storage
 */

export interface CompressionResult {
  dataUrl: string;
  originalSize: number; // bytes
  compressedSize: number; // bytes
  compressionRatio: number; // percentage saved, e.g. 92.5
  width: number;
  height: number;
  extractedStudentId?: string;
  filename: string;
}

/**
 * Format bytes to readable string (e.g. 24.5 KB, 1.2 MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Smart Student ID extractor from filename (e.g. "06055.jpg", "06055.jpeg", "std_06055.png", "06055 (1).jpg")
 */
export function extractStudentIdFromFilename(filename: string): string {
  // Strip file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  
  // Try matching 4-8 digit numeric student ID (e.g. 06055, 12345, 05505)
  const numericMatch = nameWithoutExt.match(/\b\d{4,8}\b/);
  if (numericMatch) {
    return numericMatch[0];
  }

  // If no 4-8 digit found, extract any continuous digits
  const anyDigitsMatch = nameWithoutExt.match(/\d+/);
  if (anyDigitsMatch) {
    return anyDigitsMatch[0];
  }

  // Fallback to cleaned filename
  return nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Client-side utility to resize & compress image file to JPEG data URL
 * Defaults to 320x380 px, 0.8 JPEG quality (~15-30 KB), saving 90-98% Firestore storage
 */
export async function compressStudentImageFile(
  file: File,
  maxWidth: number = 320,
  maxHeight: number = 380,
  quality: number = 0.8
): Promise<string> {
  const result = await compressStudentImageFileDetailed(file, maxWidth, maxHeight, quality);
  return result.dataUrl;
}

/**
 * Detailed compression with full before/after metrics
 */
export async function compressStudentImageFileDetailed(
  file: File,
  maxWidth: number = 320,
  maxHeight: number = 380,
  quality: number = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;
  const extractedStudentId = extractStudentIdFromFilename(file.name);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio preserving bounds
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw image onto canvas with high quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Calculate approximate byte size of base64 data URL
        const base64Data = dataUrl.split(',')[1] || '';
        const compressedSize = Math.round((base64Data.length * 3) / 4);
        const compressionRatio = originalSize > 0 
          ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10)
          : 0;

        resolve({
          dataUrl,
          originalSize,
          compressedSize,
          compressionRatio,
          width,
          height,
          extractedStudentId,
          filename: file.name
        });
      };
      img.onerror = () => reject(new Error(`ไม่สามารถเปิดไฟล์รูปภาพ ${file.name} ได้`));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error(`ไม่สามารถอ่านไฟล์ ${file.name} ได้`));
    reader.readAsDataURL(file);
  });
}

