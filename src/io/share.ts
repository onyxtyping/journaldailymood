/**
 * Віддати файл користувачу: на iOS — через Share Sheet (AirDrop, «Файли»),
 * на десктопі — звичайне завантаження. Жодних мережевих запитів.
 * Повертає false, якщо користувач скасував Share Sheet.
 */
export async function shareOrDownload(filename: string, content: string, mime: string): Promise<boolean> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
      // Інші помилки — пробуємо звичайне завантаження.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // iOS не розпізнає власні розширення в accept — тоді файл не вибрати. Тому лише для десктопа.
    if (!/iPhone|iPad/.test(navigator.userAgent)) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
