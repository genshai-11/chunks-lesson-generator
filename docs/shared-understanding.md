# Shared Understanding & Domain-Driven Design (DDD)

This document provides an overview of the core concepts, vocabulary (Ubiquitous Language), and architectural decisions underlying the semantic chunk generator.

## 1. Domain Overview
Dự án Semantic Chunk Analyzer (hay Mixer) xoay quanh miền (domain) quản lý, phối trộn (mix) và phân tích các thành phần kiến thức ngôn ngữ học thành các đơn vị học tập. Nó giúp tạo ra độ khó (Ohm/CVR) có thể kiểm soát được nhằm đáp ứng nhu cầu nghe/đọc của một người dùng cụ thể.

## 2. Ubiquitous Language (Key Terms / Domain Words)

Để tất cả các thành viên (Developer, AI, Domain Expert) hiểu đúng và thống nhất, đây là từ điển thuật ngữ cốt lõi:

*   **Resource (Tài nguyên):** Đơn vị kiến thức ngôn ngữ cơ bản (có thể đại diện cho cấu trúc ngữ pháp, từ loại...). Mỗi Resource có một màu sắc () và một thuộc tính độ khó gọi là .
*   **Chunk:** Đơn vị đầu ra (một câu Tiếng Anh). Nó là sự kết hợp (mix) của các Resource lại với nhau. AI chịu trách nhiệm viết ra nội dung từ sự kết hợp này.
*   **ColorCategory:** Phân loại Resource theo màu sắc (Green, Blue, Pink, Red, Yellow, Orange, Purple) giúp định hình chức năng và loại hình của nó trong câu.

#### Cognitive Load & Complexity Metrics (Các chỉ số độ khó)
*   **Ohm:** Lấy cảm hứng từ điện trở mạch điện (Điện trở não bộ khi xử lý ngôn ngữ). Thể hiện mức độ khó của một cấu trúc cơ bản.
*   **R-Total / Base TC (Text Complexity):** Tổng hoặc chỉ số đại diện độ khó của tất cả Resource được đem vào mix (thường áp dụng toán cộng cơ bản hoặc công thức mạch - ).
*   **LC (Length Complexity):** Hệ số độ dài câu. Bốn mức , , ,  mang các hệ số nhân từ nhỏ tới lớn (thường từ 1.0 tới 2.5), phản ánh việc câu càng dài não bộ càng tốn sức xử lý.
*   **TL (Topic Level):** Hệ số từ vựng chủ đề (từ 1.0 đến 2.0).
    *   Trong Topic (chủ đề), sẽ có các từ vựng dùng để đặt câu. 
    *    nhỏ (như 1.0) hướng người dùng tới từ vựng căn bản (cấp độ CEFR A1 - Casual).
    *    lớn (lên dần 2.0) bắt buộc AI chọn lựa các từ vựng hiếm, chuyên ngành, cụm từ ở cấp độ Advanced (B2 - C1).
*   **Target CVR (Complexity Value Rating):** Độ khó mục tiêu hoặc Đầu ra kỳ vọng của Chunk. Đây là chỉ số quan trọng nhất đại diện cho sự hiểu biết của người học.
    *   Công thức nền tảng của CVR: 

#### Operational Modes (Các chế độ Vận hành)
*   **Topic Mode:** Định tuyến AI cách tìm chủ đề.
    *   *Selected (Preset & Custom)*: Giao trực tiếp chủ đề cụ thể cho AI.
    *   *Random (Infer)*: Yêu cầu AI tự suy ngẫm chủ đề từ các Resource cung cấp.
*   **TL Mode:** 
    *   *Random*: Hệ thống để AI tính hệ số  còn thiếu khi biết trước ,  và . . Nghĩa là nếu CVR lớn mà câu ngắn, bắt buộc AI phải dùng từ vựng C1 dội lên.
    *   *Selected*: Cố định  bởi cấu hình người dùng kéo bằng tay.
*   **Blueprint Mode:** 
    *   *Target Ohm*: Để bộ giải (Backend) tự tìm và phối hợp Resource sao cho bám sát .
    *   *Recipe*: Người dùng tự định tuyến công thức (phải có X màu Xanh, Y màu Đỏ), không cần tìm kiếm tự động.

## 3. Module & Architectural Pattern (DDD)
*   : Đóng vai trò là Aggregate Root điều hướng sự kiện cho quá trình tạo *Draft Chunk*.
*   : Domain Service xử lý việc trò chuyện với các LLM provider bên thứ ba, chuyển từ các thực thể trừu tượng (như TL, LC, Base TC) thành Prompt Engineering để đúc ra câu thực tế.
