/**
 * Compress image on the client side to a very small size (~75kb max)
 * by scaling it down and lowering JPEG quality.
 */
export async function compressImage(file: File, maxSizeKb: number = 75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions to ensure we compress significantly
      // Max dimension 800px is usually enough for a receipt
      const maxDim = 800;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height *= maxDim / width));
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width *= maxDim / height));
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Iteratively reduce quality to meet maxSizeKb
      let quality = 0.7;
      let iterations = 0;
      const targetBytes = maxSizeKb * 1024;
      
      const attemptCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            
            if (blob.size <= targetBytes || iterations > 5 || quality <= 0.1) {
              resolve(blob);
            } else {
              quality -= 0.15;
              iterations++;
              attemptCompress();
            }
          },
          "image/jpeg",
          quality
        );
      };
      
      attemptCompress();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    
    img.src = url;
  });
}
