# Luyện Writing, Speaking & Listening VSTEP

Web app luyện thi VSTEP cho người Việt: gõ template Writing (5 dạng Task 2 + 4 dạng
thư Task 1), luyện nói Speaking 3 parts đúng giờ thi thật (AI chấm điểm từng part),
và luyện nghe Listening theo format thi thật (bấm giờ, chấm điểm tự động).

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **React 18**
- Styling: plain CSS (`app/globals.css`), sáng/tối theo `data-theme`
- **Auth.js v5** (`next-auth`) — đăng nhập Google, thay cho nickname
- **Neon Postgres** qua `@neondatabase/serverless` — lưu tiến bộ
- **AI chấm Speaking (BYOK — mỗi người dùng key riêng)**: OpenAI (`whisper-1` →
  `gpt-4o-mini`) hoặc **Gemini** (`gemini-2.0-flash` nghe audio trực tiếp + chấm
  trong 1 lần gọi). Key của từng người lưu trong localStorage của trình duyệt họ;
  server chỉ giữ `OPENAI_API_KEY` làm fallback khi người dùng chưa nhập key.

## Biến môi trường

| Biến               | Bắt buộc | Mô tả                                                        |
| ------------------ | -------- | ------------------------------------------------------------ |
| `DATABASE_URL`     | Không*   | Connection string Neon Postgres. Thiếu thì app vẫn chạy, chỉ không lưu lịch sử (UI sẽ báo rõ). |
| `OPENAI_API_KEY`   | Không*   | Key OpenAI của server, dùng làm **fallback** khi người dùng chưa nhập key riêng trong Cài đặt. |
| `OPENAI_SCORE_MODEL` | Không  | Model chấm điểm OpenAI, mặc định `gpt-4o-mini`.                     |
| `GEMINI_MODEL`     | Không    | Model Gemini chấm speaking, mặc định `gemini-2.0-flash`.            |
| `GOOGLE_CLIENT_ID` | Có       | OAuth Client ID (Web application) từ Google Cloud Console.    |
| `GOOGLE_CLIENT_SECRET` | Có   | OAuth Client Secret đi kèm.                                  |
| `AUTH_SECRET`      | Có       | Chuỗi ngẫu nhiên bất kỳ, tối thiểu 32 ký tự (VD: `openssl rand -base64 32`). |

\* Muốn lưu tiến bộ thì bắt buộc.

## AI key của từng người dùng (BYOK)

Mặc định, **mỗi người dùng nhập API key của chính mình** tại trang `/settings`
(chọn nhà cung cấp **Gemini** — miễn phí, khuyên dùng — hoặc **OpenAI**):

- Key lưu trong `localStorage` của trình duyệt người đó (`vstep_ai_provider`,
  `vstep_ai_key`), **không bao giờ** được gửi lên server để lưu trữ.
- Khi chấm bài, client gửi key kèm trong multipart form tới
  `POST /api/speaking/score` (`provider` + `apiKey`); server chỉ dùng key **tạm
  thời trong đúng request đó** — không ghi log, không lưu DB, không ghi file.
- Thứ tự ưu tiên key trong API: key của client → `OPENAI_API_KEY` của server
  (chỉ cho provider `openai`) → trả **503** với thông báo tiếng Việt hướng dẫn
  vào Cài đặt.
- `GET /api/speaking/config` trả `{ hasServerKey: boolean }` để client biết có
  fallback hay không (không lộ key).

Lấy key miễn phí: [aistudio.google.com](https://aistudio.google.com) (Gemini) ·
[platform.openai.com/api-keys](https://platform.openai.com/api-keys) (OpenAI, trả phí).

Tạo file `.env.local` (không commit):

```bash
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
OPENAI_API_KEY="sk-..."
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
AUTH_SECRET="chuỗi-ngẫu-nhiên-dài-tối-thiểu-32-ký-tự"
```

### Thiết lập Google OAuth (làm 1 lần)

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo project mới
   (hoặc dùng project có sẵn) → **APIs & Services → OAuth consent screen**:
   chọn **External**, điền tên app (VD: "Luyện VSTEP"), email hỗ trợ → **Save**.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type: **Web application**, đặt tên (VD: "vstep-typing-web").
3. Trong **Authorized redirect URIs**, thêm đúng URI này:
   `https://vstep-typing-kid23.vercel.app/api/auth/callback/google`
   (mỗi môi trường/domain khác cần thêm URI tương ứng) → **Create**.
4. Copy **Client ID** → `GOOGLE_CLIENT_ID`, **Client secret** → `GOOGLE_CLIENT_SECRET`.
5. Trên Vercel: project **vstep-typing → Settings → Environment Variables** → thêm cả 3
   biến (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, môi trường
   Production) → **Redeploy** để nhận biến mới.

> Lưu ý: OAuth consent screen ở chế độ **Testing** thì chỉ tối đa 100 tài khoản test
> (thêm trong OAuth consent screen → Test users). Muốn ai cũng đăng nhập được thì
> chuyển sang **Production** (không cần verify nếu chỉ xin quyền cơ bản
> openid/email/profile).

## Chạy dev

```bash
npm install
npm run dev
# mở http://localhost:3000
```

Build production:

```bash
npm run build
npm start
```

## Database schema

File `schema.sql` idempotent (`CREATE TABLE IF NOT EXISTS`) — chạy nhiều lần an toàn:

```bash
psql "$DATABASE_URL" -f schema.sql
```

hoặc dán nội dung vào Neon SQL Editor. Bảng (schema v2 — định danh Google):

- `users(id PK = Google sub, email, name, image, created_at)` — upsert tự động khi đăng nhập/lưu
- `writing_sessions(id, user_id, template_id, mode, accuracy, duration_sec, created_at)`
- `speaking_sessions(id, user_id, part, prompt, transcript, scores JSONB, overall, feedback, created_at)`
- `listening_sessions(id, user_id, test_id, score, total, duration_sec, answers JSONB, created_at)`

## Thêm đề Listening

Đề thi nằm trong `lib/listening.ts` (mảng `LISTENING_TESTS`). Để thêm một đề thật
(35 câu đúng format VSTEP):

1. **Chuẩn bị 14 file MP3** đặt trong `public/audio/<test-id>/`:
   - `p1-01.mp3` … `p1-08.mp3` — Part 1: 8 đoạn ngắn (thông báo/hướng dẫn/hội thoại
     ngắn), mỗi đoạn 1 câu hỏi (Q1–8)
   - `p2-01.mp3` … `p2-03.mp3` — Part 2: 3 đoạn hội thoại, mỗi đoạn 4 câu hỏi (Q9–20)
   - `p3-01.mp3` … `p3-03.mp3` — Part 3: 3 bài nói/bài giảng, mỗi bài 5 câu hỏi (Q21–35)
2. **Thêm một object `ListeningTest`** vào `LISTENING_TESTS` (copy mẫu có sẵn trong
   comment TEMPLATE ở cuối file `lib/listening.ts`): mỗi recording gồm `label`
   (tiếng Việt), `audio` (đường dẫn `/audio/<test-id>/….mp3`), `script` (transcript
   hiện ở chế độ xem lại), và `questions` (`q`, `options` 4 đáp án, `answer` là
   index đáp án đúng). Số thứ tự câu 1..35 được đánh tự động theo thứ tự khai báo.
3. **Redeploy** app (file MP3 được serve tĩnh từ `public/`).

Lưu ý bản quyền: chỉ đưa lên đề do bạn tự soạn hoặc có quyền sử dụng.

## Định danh

Đăng nhập Google qua Auth.js v5 (`lib/auth.ts`, route `/api/auth/[...nextauth]`).
Client dùng `useSession()` (`next-auth/react`, bọc bởi `components/Providers.tsx`).
Mọi API đọc/ghi đều gọi `auth()` phía server và trả **401** nếu chưa đăng nhập —
không tin nickname/tham số từ client.

## Cấu trúc

```
app/
  page.tsx              Trang chủ: đăng nhập Google, chọn Writing/Speaking
  settings/page.tsx     Cài đặt AI: chọn nhà cung cấp + nhập API key riêng (lưu localStorage)
  writing/page.tsx      Chọn dạng bài Task 1 / Task 2
  writing/[type]/page.tsx  Màn hình luyện gõ (từng phần / toàn bài / thi thử / tự nhớ / drill từ sai / ví dụ mẫu / dark mode)
  speaking/page.tsx     3 parts đúng giờ thi thật, ghi âm + AI chấm (cần đăng nhập + API key)
  listening/page.tsx    Danh sách đề listening
  listening/[id]/page.tsx  Màn hình làm bài: bấm giờ, palette câu hỏi, chọn A/B/C/D, nộp bài → chấm điểm + xem lại transcript
  progress/page.tsx     Lịch sử + thống kê theo tài khoản Google
  api/auth/[...nextauth]  Auth.js v5: GET/POST (Google OAuth)
  api/writing/save      POST {templateId, mode, accuracy, durationSec} — cần đăng nhập
  api/writing/history   GET — cần đăng nhập
  api/listening/save    POST {testId, score, total, durationSec, answers} — cần đăng nhập
  api/listening/history GET — cần đăng nhập
  api/speaking/score    POST multipart {audio, part, prompt, provider?, apiKey?} → {transcript, scores, overall, feedback_vi} — cần đăng nhập; key client ưu tiên, fallback OPENAI_API_KEY của server
  api/speaking/config   GET → {hasServerKey} — client biết có fallback server hay không
  api/speaking/history  GET — cần đăng nhập
lib/
  auth.ts               Cấu hình Auth.js v5 (Google provider, session.user.id = Google sub)
  aiKey.ts              Đọc/ghi key AI của người dùng trong localStorage (vstep_ai_provider, vstep_ai_key)
  templates.ts          Toàn bộ template Writing (port nguyên văn từ trang cũ)
  examples.ts           Ví dụ điền sẵn cho từng template ("Xem ví dụ điền sẵn")
  speaking.ts           Đề speaking 3 parts + tiêu chí chấm + thời gian thi
  listening.ts          Đề listening (types + mảng LISTENING_TESTS + template đề 35 câu)
  db.ts                 Neon client (null khi thiếu DATABASE_URL) + ensureUser()
components/
  Providers.tsx         SessionProvider bọc toàn app (dùng trong layout.tsx)
public/
  audio/demo/           3 clip MP3 mẫu cho "Đề demo" (TTS)
schema.sql              Schema idempotent (v2 — định danh Google)
migrations/
  002_listening.sql     Tạo bảng listening_sessions (chạy 1 lần trên Neon)
```

## Ghi chú khi mở rộng

- Thêm dạng bài Writing mới: thêm object vào `TEMPLATES` trong `lib/templates.ts`
  (kèm ví dụ trong `lib/examples.ts`) — trang `/writing` tự hiện.
- Thêm đề Speaking: thêm vào `PART1_SETS` / `PART2_SITUATIONS` / `PART3_TOPICS`
  trong `lib/speaking.ts`.
- Prompt chấm Speaking nằm trong `app/api/speaking/score/route.ts` (`systemPrompt`).
  Tiêu chí chấm chính thức VSTEP: grammar, vocabulary, pronunciation, fluency,
  discourse_management — thang 0–10, điểm tổng = trung bình làm tròn đến 0.5.
  Điểm phát âm của AI chỉ mang tính tương đối (đã ghi rõ trong prompt và UI).
