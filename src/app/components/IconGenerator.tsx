/**
 * IconGenerator - Generates PNG icons from SVG at runtime for PWA/iOS compatibility.
 * Runs once on mount to create apple-touch-icon PNG since iOS Safari doesn't support SVG touch icons.
 */
export function generatePWAIcons() {
  if (typeof document === 'undefined') return;

  const sizes = [192, 512];
  const svgUrl = '/icon.svg';

  sizes.forEach((size) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw white background first (for transparency issues on some devices)
      ctx.fillStyle = '#AB1738';
      ctx.fillRect(0, 0, size, size);

      // Draw the SVG
      ctx.drawImage(img, 0, 0, size, size);

      const pngDataUrl = canvas.toDataURL('image/png');

      // Update apple-touch-icon for iOS home screen
      if (size === 192) {
        let link = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
        if (link) {
          link.href = pngDataUrl;
        } else {
          link = document.createElement('link');
          link.rel = 'apple-touch-icon';
          link.href = pngDataUrl;
          document.head.appendChild(link);
        }

        // Also set as standard icon fallback
        let iconLink = document.querySelector('link[rel="icon"][type="image/png"]') as HTMLLinkElement;
        if (!iconLink) {
          iconLink = document.createElement('link');
          iconLink.rel = 'icon';
          iconLink.type = 'image/png';
          iconLink.setAttribute('sizes', '192x192');
          document.head.appendChild(iconLink);
        }
        iconLink.href = pngDataUrl;
      }
    };
    img.src = svgUrl;
  });
}
