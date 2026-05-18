import { measureCVR } from "./src/services/aiService.ts";

async function run() {
    const transcript = "Mọi người trong phòng kinh doanh đang chờ sếp thổi nến. Công ty này ép doanh số, ai rồi cũng sẽ... nghỉ việc sớm thôi. Thì tui đã nói nãy giờ đóooo!,... mau tìm việc mới đi. Nhưng TC lại bắt cả những cụm, không tồn tại trong câu?";
    try {
        console.log("transctipt words:", transcript.split(/\s+/).filter((w) => w.trim().length > 0).length);
        const res = await measureCVR(transcript, undefined, undefined, []);
        console.log(res.lcBreakdown);
    } catch(e) {
        console.error(e);
    }
}
run();
