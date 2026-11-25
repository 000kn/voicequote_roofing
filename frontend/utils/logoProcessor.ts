export async function processLogoImage(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(src);

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width, minY = height, maxX = 0, maxY = 0, hasPixels = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) {
            data[i + 3] = 0;
          } else if (data[i + 3] > 10) {
            hasPixels = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasPixels) return resolve(src);
      ctx.putImageData(new ImageData(data, width, height), 0, 0);

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      out.getContext("2d")?.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}