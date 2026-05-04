# RCET Lab System — User Manual (Detail)

Tài liệu này gồm:
- **Hướng dẫn chạy hệ thống (dev/local)**: SQL Server + Backend (Node.js) + Frontend (Vite/React).
- **User Manual chi tiết**: thao tác theo vai trò (role), các màn hình/chức năng, luồng nghiệp vụ chính, lỗi thường gặp.

> Lưu ý bảo mật: Không commit các file chứa bí mật (ví dụ `.env`). Nếu lỡ để lộ khóa SMTP/OAuth/Cloudinary/Groq… hãy **rotate** (thay mới) ngay.

---

## 1) Tổng quan nhanh

- **Frontend**: chạy mặc định tại `http://localhost:5173`
- **Backend API**: chạy mặc định tại `http://localhost:3000`
  - **Health check**: `GET /api/health`
  - **Swagger UI**: `http://localhost:3000/api-docs`
  - **Swagger JSON**: `http://localhost:3000/api-docs.json`
- **API base URL (FE dùng)**: cấu hình trong `RCET---Frontend/RCET--frontend/.env`
  - `VITE_API_URL=http://localhost:3000/api`

---

## 2) Yêu cầu môi trường (Local/Dev)

### 2.1 Phần mềm cần có

- **Node.js** (khuyến nghị bản LTS; dự án đang chạy tốt với Node 20+)
- **npm**
- **Microsoft SQL Server** (SQL Server 2012+ để tương thích cú pháp OFFSET/FETCH)
  - Bật TCP/IP và port **1433** nếu dùng mặc định
  - Có user DB (thường là `sa`) và mật khẩu hợp lệ

### 2.2 Cơ sở dữ liệu

Backend dùng MSSQL qua Sequelize (`tedious`).

Các biến môi trường DB nằm trong `Backend/RCET---Backend/.env`:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME` (mặc định thường là `rcet_lab`)
- `DB_USER`
- `DB_PASSWORD`

---

## 3) Chạy hệ thống (Backend + Frontend)

### 3.1 Chạy Backend

Mở terminal tại:
`Backend/RCET---Backend`

Chạy lần đầu:

```bash
npm install
```

Đồng bộ schema (tạo bảng nếu chưa có):

```bash
npm run db:sync
```

Seed dữ liệu mẫu (tạo user + project + task + …):

```bash
npm run seed
```

Chạy server:

```bash
npm run dev
```

Nếu muốn reset toàn bộ DB (xóa & tạo lại schema) rồi seed lại:

```bash
npm run db:reset
npm run seed
```

### 3.2 Chạy Frontend

Mở terminal tại:
`RCET---Frontend/RCET--frontend`

```bash
npm install
npm run dev
```

Truy cập giao diện:
`http://localhost:5173`

---

## 4) Tài khoản mẫu (Seed)

Sau khi chạy `npm run seed`, có thể đăng nhập bằng các tài khoản sau:

- **Admin hệ thống**
  - Email: `admin@lab.com`
  - Mật khẩu: `Admin123!`
  - Role: `admin`

- **Viện trưởng**
  - Email: `vientruong@lab.com`
  - Mật khẩu: `Lab@12345`
  - Role: `vien_truong`

- **Trưởng lab**
  - Email: `truonglab@lab.com`
  - Mật khẩu: `Lab@12345`
  - Role: `truong_lab`

- **Leader**
  - `leader1@lab.com` / `Lab@12345`
  - `leader2@lab.com` / `Lab@12345`

- **Member**
  - `member1@lab.com` / `Lab@12345`
  - `member2@lab.com` / `Lab@12345`
  - `member3@lab.com` / `Lab@12345`
  - `member4@lab.com` / `Lab@12345`

- **User thường**
  - `user@lab.com` / `User123!`

> Gợi ý: Khi demo/đồ án, nên giữ seed accounts để dễ test luồng quyền hạn.

---

## 5) Vai trò (Roles) và phạm vi quyền

Hệ thống có các role chính (xem `system_role`):

- **user**: người dùng thường, tham gia dự án, xem/đăng bài diễn đàn, xem tài nguyên công khai.
- **member**: thành viên dự án (thường giống user nhưng trong bối cảnh dự án được gán vai trò thành viên).
- **leader**: trưởng nhóm dự án (quản lý task/members theo quyền trong project).
- **truong_lab**: quản lý lab (tạo/soạn tài liệu/giáo trình, xem CV ứng viên, …).
- **vien_truong**: phê duyệt cấp cao (duyệt research/tài liệu/giáo trình, tạo/xác nhận hợp đồng cộng tác, quản trị Verilog nâng cao).
- **admin**: quản trị hệ thống (quản lý users, audit/security).

Ngoài ra, quyền trong **Project** thường được quản lý theo vai trò thành viên dự án (member/leader, …) ở tab Members.

---

## 6) Hướng dẫn sử dụng theo màn hình/chức năng

### 6.1 Đăng ký / Đăng nhập / Quên mật khẩu

- **Đăng ký**: vào `/register`
  - Nhập thông tin cơ bản → tạo tài khoản.
- **Đăng nhập**: vào `/login`
  - Đăng nhập bằng email/mật khẩu.
  - Có hỗ trợ Google OAuth (nếu backend đã cấu hình `GOOGLE_CLIENT_ID/SECRET`).
- **Quên mật khẩu**: `/forgot-password`
  - Nhập email → hệ thống gửi link reset qua SMTP (cần cấu hình SMTP trong backend).
- **Reset mật khẩu**: `/reset-password` hoặc `/auth/reset-password`
  - Mở link trong email → đặt mật khẩu mới.
- **Chờ duyệt (nếu áp dụng)**: `/pending-approval`

### 6.2 Trang chủ

- URL: `/`
- Mục đích: giới thiệu/tổng quan, điều hướng nhanh đến các phân hệ (Publication, Projects, Verilog, …).

### 6.3 Hồ sơ cá nhân (User Profile)

- URL: `/user-profile`
- Chức năng thường có:
  - Cập nhật thông tin cá nhân
  - Đổi mật khẩu (UI có thể điều hướng qua `#doi-mat-khau`)
  - Cập nhật ảnh đại diện (backend hỗ trợ `/api/uploads` và endpoint avatar trong auth)

### 6.4 Dashboard (User)

- URL: `/dashboard`
- Mục đích: xem tổng hợp (thông báo, dự án đang tham gia, task/report gần đây… tùy cấu hình UI).

### 6.5 Quản lý dự án (Projects)

- **Danh sách dự án**: `/projects`
  - Xem danh sách dự án bạn tham gia.
  - Mở chi tiết dự án.
- **Tạo dự án**: `/projects/new`
  - Nhập thông tin dự án (tên, mô tả, thời gian, tag, …) → tạo.
- **Chi tiết dự án**: `/projects/:id`
  - Gồm các tab chính:
    - **Overview**: thông tin tổng quan, trạng thái, mô tả.
    - **Tasks**: tạo/giao việc, trạng thái (todo/in-progress/done…), ưu tiên, hạn chót.
    - **Master Plan / Milestones**: tạo mốc (milestone), gắn task vào milestone.
    - **Members**: thêm/xóa thành viên dự án, phân vai trò trong dự án.
    - **Reports (Weekly Reports)**: nộp báo cáo tuần, xem lịch sử, theo dõi compliance.
    - **Rewards**: tổng hợp/kết xuất sheet thưởng (nếu dự án bật tính năng này).

### 6.6 Publication — Research (Công bố nghiên cứu)

- **Danh sách research**: `/publication/research`
  - Xem danh sách nghiên cứu/công bố.
  - Mở chi tiết.
- **Chi tiết**: `/publication/research/:id`
- **Nộp research**: `/publication/research/submit` (cần đăng nhập)
  - Nhập metadata + upload/đính kèm (nếu UI hỗ trợ) → gửi duyệt.
- **Bài đã nộp của tôi**: `/publication/research/mine`
- **Duyệt research**: `/publication/research/approvals` (chỉ `vien_truong`)
  - Duyệt/ từ chối, ghi chú phản hồi.

### 6.7 Publication — Books: Documents (Tài liệu kỹ thuật)

Các trang chính:
- **Danh sách**: `/publication/books/documents`
- **Tạo mới**: `/publication/books/documents/create` (chỉ `truong_lab` hoặc `vien_truong`)
- **Của tôi**: `/publication/books/documents/mine`
- **Duyệt**: `/publication/books/documents/approvals` (chỉ `vien_truong`)
- **Chi tiết**: `/publication/books/documents/:id`
- **Chỉnh sửa**: `/publication/books/documents/:id/edit` (chỉ role đủ quyền)

Luồng nghiệp vụ gợi ý:
1) Trưởng lab tạo tài liệu → gửi duyệt
2) Viện trưởng duyệt → tài liệu được publish
3) Người dùng xem chi tiết / tải tài liệu (tùy UI)

### 6.8 Publication — Curriculum (Giáo trình)

Tương tự Documents:
- Danh sách: `/publication/curriculum`
- Tạo: `/publication/curriculum/create` (chỉ `truong_lab` hoặc `vien_truong`)
- Của tôi: `/publication/curriculum/mine`
- Duyệt: `/publication/curriculum/approvals` (chỉ `vien_truong`)
- Chi tiết: `/publication/curriculum/:id`
- Sửa: `/publication/curriculum/:id/edit`

### 6.9 Categories (Phân loại tài liệu/giáo trình)

- URL: `/category`
- Mục đích: quản lý danh mục phục vụ phân loại Documents/Curriculum.

### 6.10 Forums (Diễn đàn)

- URL: `/publication/forums`
- Chức năng thường có:
  - Tạo bài viết (Forum Post)
  - Bình luận (Comment)
  - Like
  - (Tuỳ cấu hình backend) kiểm duyệt nội dung bằng AI khi có `GROQ_API_KEY`

### 6.11 Information Portal / Lab Information

- **Information Portal**: `/publication/information-portal`
- **Lab Information**: `/publication/information`

Mục đích: đăng/tham khảo thông tin chung của phòng lab (quy định, thông báo, giới thiệu…).

### 6.12 Verilog (Bài tập + nộp bài)

Các trang chính:
- **Danh sách bài**: `/verilog`
- **Chi tiết bài**: `/verilog/:id`
- **Bài đã nộp của tôi**: `/verilog/submissions` (cần đăng nhập)
- **Quản lý bài/đề**: `/verilog/management` (chỉ `vien_truong`)
- **Tất cả submissions**: `/verilog/all-submissions` (chỉ `vien_truong`)

Lưu ý môi trường chấm:
- Backend có dịch vụ judge; trên Windows có thể cần cài Icarus Verilog và cấu hình:
  - `IVERILOG_PATH`
  - `VVP_PATH`
  - (tuỳ chọn) `YOSYS_PATH`

Nếu thiếu công cụ, hệ thống vẫn có thể chạy nhưng một số bước chấm/syntax check sẽ bị giới hạn.

### 6.13 CV / Ứng tuyển cộng tác & Hợp đồng

Luồng tổng quan:

1) **User nộp CV**
   - URL: `/submit-cv` (cần đăng nhập, admin không dùng route này)
2) **Trưởng lab / Viện trưởng xem danh sách CV**
   - URL: `/publication/cv-approvals` (chỉ `truong_lab` hoặc `vien_truong`)
3) **Xem chi tiết CV**
   - URL: `/publication/cv-approvals/:id`
4) **Viện trưởng tạo hợp đồng cộng tác**
   - URL: `/publication/cv-approvals/:id/contract` (chỉ `vien_truong`)
5) **Viện trưởng xem hợp đồng đã lưu (nhúng file)**
   - URL: `/publication/cv-approvals/:id/contract/view` (chỉ `vien_truong`)

---

## 7) Thông báo (Notifications) & realtime

- Backend có Socket.IO bật sẵn, hỗ trợ realtime updates.
- Người dùng sẽ nhận thông báo theo sự kiện (tùy nghiệp vụ: task/report/approval…).

---

## 8) Xử lý sự cố thường gặp

### 8.1 Backend báo “EADDRINUSE: 3000”

Nguyên nhân: port 3000 đang bị process khác chiếm.

Cách xử lý:
- Tắt process đang dùng port 3000, hoặc
- Đổi `PORT` trong `Backend/RCET---Backend/.env` sang port khác (ví dụ 3001) và cập nhật `VITE_API_URL` tương ứng.

### 8.2 Backend không kết nối được SQL Server

Kiểm tra:
- SQL Server service đang chạy
- TCP/IP enable, port đúng (thường 1433)
- `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` đúng
- Tài khoản DB có quyền tạo/đọc ghi

### 8.3 Quên chạy seed → không có tài khoản demo

Chạy lại:

```bash
npm run seed
```

Nếu schema đang lệch nhiều, reset rồi seed:

```bash
npm run db:reset
npm run seed
```

### 8.4 Không nhận được email reset password

Kiểm tra backend `.env`:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Nếu dùng Gmail: cần App Password và bật cấu hình phù hợp.

### 8.5 Google OAuth lỗi callback

Kiểm tra:
- `GOOGLE_CALLBACK_URL` phải khớp cấu hình trong Google Cloud Console
- FE dùng đúng URL login Google (xem `VITE_GOOGLE_AUTH_URL`)

---

## 9) Checklist demo nhanh (đồ án)

- [ ] SQL Server chạy, DB `rcet_lab` sẵn sàng
- [ ] Backend `npm run dev` (mở được `http://localhost:3000/api-docs`)
- [ ] Frontend `npm run dev` (mở được `http://localhost:5173`)
- [ ] `npm run seed` đã tạo user demo
- [ ] Đăng nhập role `user` → thao tác Projects/Forums/Research submit
- [ ] Đăng nhập role `vien_truong` → duyệt Research/Documents/Curriculum + tạo hợp đồng
- [ ] Đăng nhập `admin` → xem Admin dashboard/users/security

