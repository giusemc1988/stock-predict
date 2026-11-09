# Session notes

- **Bản hiện hành:** kiểm tra bằng `git status -sb`, `git rev-parse HEAD` và `git rev-parse origin/main`; không dùng tên thư mục Graphify làm bằng chứng. Trước merge/deploy task thì `git fetch origin main` và đọc SHA của main. `graphify-out/GRAPH_REPORT.md` đang ghi nguồn `9464dc78` (tài liệu cũ), nên chỉ dùng để định vị; không sửa source dựa riêng vào đó. Bản live Cloudflare chỉ xác minh qua Actions deploy thành công và điểm kiểm tra public được phép; app UI sau Cloudflare Access cần anh kiểm tra trên trình duyệt/điện thoại.
- **Cập nhật lần gần nhất (2026-11-09):** PR #267 đã merge vào main; local main `a679ef8`, Deploy Worker run `42689293198` succeeded. GitHub/local source là phiên bản mới nhất đã xác minh; trạng thái UI live sau Access chưa kiểm chứng độc lập.
- **Test workflow (2026-11-09):** đang chạy CI/CD pipeline check để xác nhận toàn quyền hoạt động đúng với handoff. Bản thử nghiệm sử dụng NHÁNH tách, PR review → squash-merge → auto-deploy.
