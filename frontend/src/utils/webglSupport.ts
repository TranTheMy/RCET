/**
 * Kiểm tra nhanh xem trình duyệt có tạo được WebGL context không.
 * Một số môi trường (GPU/driver, policy, quá nhiều context) trả về null → không nên mount Spline.
 */
export function getWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl != null;
  } catch {
    return false;
  }
}
