import { useEffect, useState, type ComponentProps } from 'react';
import Spline from '@splinetool/react-spline';

type SplineProps = ComponentProps<typeof Spline>;

export type SplineDeferredProps = SplineProps & {
  /** requestIdleCallback timeout cap (ms); sau đó vẫn mount dù chưa idle */
  idleTimeoutMs?: number;
};

/**
 * Trì hoãn mount Spline đến khi main thread rảnh (hoặc timeout), giảm spike CPU/log
 * ngay sau đăng nhập / F5. Không xóa được cảnh báo "Missing property" nếu file .splinecode
 * lỗi timeline — cần mở Spline Editor và export lại scene.
 */
export function SplineDeferred({ idleTimeoutMs = 1500, ...props }: SplineDeferredProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: idleTimeoutMs });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, [idleTimeoutMs]);

  if (!ready) {
    return <div className={props.className} style={props.style} aria-hidden />;
  }

  return <Spline {...props} />;
}
