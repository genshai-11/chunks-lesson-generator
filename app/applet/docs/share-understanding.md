# Shared Understanding & Domain-Driven Design (DDD)

This document provides an overview of the core concepts, vocabulary (Ubiquitous Language), and architectural decisions underlying the semantic chunk generator.

## 1. Domain Overview
Dự án Semantic Chunk Analyzer (hay Mixer) xoay quanh miền (domain) quản lý, phối trộn (mix) và phân tích các thành phần kiến thức ngôn ngữ học thành các đơn vị học tập. Nó tính toán và tạo ra một mức độ khó kiểm soát được để đáp ứng phù hợp năng lực tiếp thu của người dùng.

## 2. Ubiquitous Language (Từ điển Thuật ngữ / Key Terms)

Để tất cả các thành viên (Developer, AI, Domain Expert) hiểu đúng và thống nhất, đây là từ điển thuật ngữ cốt lõi:

*   **Resource (Tài nguyên):** Đơn vị kiến thức ngôn ngữ cơ bản (có thể đại diện cho cấu trúc ngữ pháp, từ loại...). Mỗi Resource có một màu sắc (`Color`) và một thuộc tính độ khó gọi là `Ohm`.
*   **Chunk:** Đơn vị đầu ra cuối cùng (một đoạn/câu văn). Nó là sự kết hợp (mix) của các Resource lại với nhau. AI chịu trách nhiệm sinh ra nội dung (tiếng Anh) cùng bản dịch (tiếng Việt) dựa trên tổ hợp này.
*   **ColorCategory:** Phân loại Resource theo màu sắc (Green, Blue, Pink, Red, Yellow, Orange, Purple) giúp định hình chức năng ngữ pháp và vị thế hình bóng sự vật/thuộc tính trong câu.

#### Cognitive Load & Complexity Metrics (Các chỉ số độ khó nhận thức)
*   **Ohm:** Lấy cảm hứng từ vật lý (điện trở). Nó đo lường sức cản của não bộ khi xử lý cấu trúc ngôn ngữ này (Cognitive Load). Mỗi Resource khi nạp vào hệ thống mang một số điểm Ohm riêng theo mức độ khó của từ loại hay ngữ pháp đó.
*   **Base TC (Text Complexity / Trọng tải hệ thống - Load / R-Total):** Thể hiện tổng trọng tâm độ khó cấu trúc của toàn bộ Resource được cấp cho AI mix. Có 2 cách tính (Formula Mode):
    *   *Sum*: Cộng dồn trực tiếp (VD: mix 2 resource Ohm 5 và Ohm 7 thì Base TC = 12).
    *   *Circuit*: Thừa kế công thức điện trở song song/nối tiếp của mạch điện, làm mềm chỉ số để tránh quá tải khi mix lượng lớn.
*   **LC (Length Complexity / Hệ số độ dài):** Câu dài hay ngắn. Câu càng dài não bộ càng tốn sức ghi nhớ và xử lý. Hệ thống chia làm 4 mức với hệ số nhân tịnh tiến (được set mặc định):
    *   `Very Short`: 1.0 (ít hơn 2 câu, số từ dưới 15)
    *   `Short`: 1.5 (ít hơn 2 câu, số từ dưới 30)
    *   `Medium`: 2.0 (ít hơn 3 câu, số từ dưới 60)
    *   `Long`: 2.5 (kịch trần 5 câu, số từ dưới 100)
*   **TL (Topic Level / Hệ số rào cản từ vựng):** Hệ số độ khó từ vựng và chủ đề, dàn trải từ 1.0 đến 2.0.
    *   *Trong Topic (chủ đề)* bộ tạo sinh của AI sẽ quyết định chủ đề sẽ chứa các từ vựng nào để đặt câu.
    *   `TL` thấp (Từ 1.0 - 1.3): Hướng người dùng tới từ vựng căn bản của đời sống (Daily Life, Food, Hobbies) - cấp độ CEFR A1/A2.
    *   `TL` trung bình (Từ 1.4 - 1.7): Chủ đề văn phòng, học thuật phổ thông (Health, Workplace, Tech) - cấp độ B1/B2.
    *   `TL` cao (Từ 1.8 - 2.0): Bắt buộc AI chọn lựa các từ vựng hiếm, cấu trúc chuyên ngành mang tính triết lý, học thuật cao (Economics, Science, Philosophy, Law) - cấp độ C1/C2 cấp cao.
*   **Target CVR (Complexity Value Rating / Total Ohm):** Đây là đầu ra kỳ vọng độ khó cuối cùng (Total Ohm) của một Chunk, được hệ quy chiếu theo năng lực của người học. Đạt chuẩn khi khớp với sức cản hiện hành của não bộ.
    *   Công thức cốt lõi: `CVR = Base TC * LC * TL`
    *   Trong đó `LC * TL` thường được gọi chung là **Bias (Multiplier) - I-Value**.
    *   *Ví dụ*: Base TC = 10, LC (Short = 1.5), TL (Daily Life = 1.0). CVR cần đạt sẽ là `10 * 1.5 * 1.0 = 15`. 
    *   Nếu người dùng chủ động yêu cầu 1 Target CVR cao hơn quy định, AI bằng cách nào đó phải ép thêm các cụm từ khó và viết theo mạch logic phức tạp hơn (VD: CVR tự nhiên là 15 nhưng User đòi Target = 20, AI sẽ phải đôn từ vựng lên hoặc đổi giọng điệu hàn lâm hơn).

#### Operational Modes (Chế độ Mix / Vận hành)
*   **Topic Mode:** Định tuyến AI cách tìm chủ đề khi tạo Chunk.
    *   *Selected (Preset & Custom)*: Giao chủ đề cố định hoặc người dùng tự bổ sung chủ đề (ví dụ: "Crypto Trading"). Icon theo chủ đề dễ nhận diện.
    *   *Random (Infer)*: Yêu cầu AI tự đọc bảng Resource trộn và tuỳ biến ngẫu nhiên một topic thích hợp.
*   **TL Mode (Chế độ tự xác định TL):** 
    *   *Random*: Vì TL bị phụ thuộc định lí Toán vào hệ số (Base TC), (LC) và (CVR Target). Nên tính được giá trị: `requiredTL = Target CVR / (Base TC * LC)`. Ở chế độ ngẫu nhiên này, tuỳ vào độ phức tạp CVR đòi hỏi, AI tự tính và đẩy độ khó từ vựng lên cao (buộc phải dùng từ C1 nếu CVR cao ngất ngưởng) hay thấp.
    *   *Selected*: Cố định `TL` bởi người dùng tự điều chỉnh thông qua thanh kéo (manual range).
*   **Blueprint Mode:** 
    *   *Target Ohm Mode*: Backend được uỷ nhiệm phép thử (brute-force hoặc lặp) tự tìm và mix Resource tuân thủ để bám sát `Target CVR` nhất.
    *   *Recipe Mode*: Mix tự động theo các khối số lượng được fix cứng (VD mix 1 khối từ vựng màu Đỏ và 2 khối màu Xanh) do User chủ động định ra cấu trúc.

## 3. Module & Architectural Pattern (DDD)
*   `MixerTab`: Đóng vai trò là `Aggregate Root` cho việc trộn. Điều hướng sự kiện người dùng thành Entity của *Draft Chunk* và uỷ quyền cho Domain Service.
*   `AI Service`: Sắm vai trò là `Domain Service` giao thiệp qua lớp cơ sở hạ tầng (APIs LLM), biên dịch từ các tham số (như TL, LC, Base TC) biến đổi (Transform) ra ngữ cảnh Prompt logic để đúc ra câu thực tế và trả về. Mọi quá trình logic khó về Prompt và Parameter đóng gói ở service này.
