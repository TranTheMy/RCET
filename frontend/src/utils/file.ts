/**
 * Kích hoạt việc tải một đối tượng Blob xuống máy tính của người dùng.
 *
 * @param blob - Đối tượng Blob (thường nhận từ API có responseType: 'blob').
 * @param filename - Tên file gợi ý cho người dùng khi lưu.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  // 1. Tạo một URL tạm thời cho đối tượng Blob
  const url = window.URL.createObjectURL(blob);

  // 2. Tạo một thẻ <a> ẩn trong DOM
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename; // Đặt tên file sẽ được tải về

  // 3. Thêm thẻ <a> vào body và giả lập một cú click
  document.body.appendChild(a);
  a.click();

  // 4. Dọn dẹp: xóa thẻ <a> và thu hồi URL đã tạo
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}