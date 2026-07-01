import { useEffect, useState } from 'react';
import { getToken } from '../../lib/auth';

const apiUrl = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001';

function toAbsoluteUploadUrl(src: string): string {
  return src.startsWith('http') ? src : `${apiUrl}${src}`;
}

function isApiUpload(src: string): boolean {
  if (src.startsWith('/uploads/')) return true;

  try {
    const url = new URL(src);
    return (
      url.origin === new URL(apiUrl).origin &&
      url.pathname.startsWith('/uploads/')
    );
  } catch {
    return false;
  }
}

export type AuthenticatedImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  onClick?: () => void;
};

export function AuthenticatedImage({
  src,
  alt,
  className,
  loading,
  onClick,
}: AuthenticatedImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(
    isApiUpload(src) ? null : src,
  );

  useEffect(() => {
    if (!isApiUpload(src)) {
      setDisplaySrc(src);
      return;
    }

    const token = getToken();
    if (!token) {
      setDisplaySrc(null);
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();

    void Promise.resolve(
      fetch(toAbsoluteUploadUrl(src), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }),
    )
      .then(async (response) => {
        if (!response?.ok) {
          throw new Error('Image unavailable');
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setDisplaySrc(objectUrl);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setDisplaySrc(null);
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!displaySrc) return null;

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      onClick={onClick}
      className={className}
    />
  );
}
