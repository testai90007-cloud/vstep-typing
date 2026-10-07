import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureUser, getSql } from '@/lib/db';

// Transcription + LLM scoring can take a while; allow up to 60s on Vercel.
export const runtime = 'nodejs';
export const maxDuration = 60;

const SCORE_MODEL = process.env.OPENAI_SCORE_MODEL || 'gpt-4o-mini';
const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type Provider = 'openai' | 'gemini';

interface CriterionScores {
  grammar: number;
  vocabulary: number;
  pronunciation: number;
  fluency: number;
  discourse_management: number;
}

const PART_CONTEXT: Record<number, string> = {
  1: 'Part 1 · Social Interaction: the candidate gives short answers to personal questions about familiar topics (family, study, work, free time...). Expect brief, natural responses, not a long monologue.',
  2: 'Part 2 · Solution Discussion: the candidate was given a situation with THREE options, had 1 minute to prepare, and should choose the best option and justify the choice (about 2-3 minutes of talk). Reward clear choice + reasons; penalize ignoring the options.',
  3: 'Part 3 · Topic Development: the candidate was given a topic with a mind-map, had 1 minute to prepare, and should develop the topic into a sustained monologue (about 3-4 minutes). Reward topic development using the given points plus own ideas, and coherent structure.',
};

function systemPrompt(part: number): string {
  return `You are an experienced VSTEP speaking examiner. Score the candidate's spoken response for VSTEP Speaking ${PART_CONTEXT[part] || ''}

Official VSTEP speaking criteria — score EACH from 0 to 10 (decimals like 6.5 allowed):
- grammar: grammatical range and accuracy (variety of structures, error frequency)
- vocabulary: lexical resource (range, collocation, paraphrase, word choice)
- pronunciation: CANNOT be judged reliably from a transcript. Base it only on indirect clues (very short/fragmented output may hint at delivery issues) and mark it as APPROXIMATE — keep it close to the average of the other criteria unless there is strong evidence otherwise. Never invent specific pronunciation errors.
- fluency: fluency and coherence (flow, hesitation markers like "uh/um", repetition, self-correction visible in transcript, linking)
- discourse_management: organization and development of ideas (clear structure, relevant content, full coverage of the task)

Rules:
- Score what was actually said. Very short or off-topic responses score low on task-relevant criteria.
- Do not punish the candidate for transcription artifacts like missing punctuation.
- feedback_vi: 3-6 bullet points IN VIETNAMESE, specific and actionable (quote 1-2 of their phrases when useful, show a better version). Start with one strength, then weaknesses in priority order. If pronunciation is marked approximate, say so briefly in Vietnamese.

Respond with JSON ONLY in this shape:
{"scores":{"grammar":0,"vocabulary":0,"pronunciation":0,"fluency":0,"discourse_management":0},"feedback_vi":"..."}`;
}

function geminiPrompt(part: number, prompt: string): string {
  return `Bạn là giám khảo Speaking VSTEP giàu kinh nghiệm. Nghe kỹ bản ghi âm đính kèm rồi làm 2 việc:

1. TRANSCRIPT: chép lại TOÀN BỘ lời thí sinh nói (tiếng Anh, giữ nguyên cả những từ ngập ngừng như "uh", "um").
2. CHẤM ĐIỂM theo đúng format bài thi: ${PART_CONTEXT[part] || ''}

Chấm MỖI tiêu chí từ 0 đến 10 (cho phép số lẻ .5):
- grammar: độ đa dạng và chính xác của ngữ pháp (cấu trúc câu, tần suất lỗi)
- vocabulary: vốn từ vựng (độ phong phú, collocation, paraphrase, chọn từ)
- pronunciation: KHÔNG thể đánh giá đáng tin cậy nếu chỉ nghe gián tiếp. Chỉ dựa vào manh mối gián tiếp và đánh dấu là TƯƠNG ĐỐI — giữ điểm gần với trung bình các tiêu chí khác trừ khi có bằng chứng rõ ràng. Tuyệt đối không bịa ra lỗi phát âm cụ thể.
- fluency: độ trôi chảy và mạch lạc (ngập ngừng, lặp từ, tự sửa, từ nối)
- discourse_management: tổ chức và triển khai ý (cấu trúc rõ ràng, đúng trọng tâm đề, bao quát đủ yêu cầu)

Quy tắc:
- Chỉ chấm những gì thí sinh thực sự nói. Bài quá ngắn hoặc lạc đề thì điểm thấp ở các tiêu chí liên quan.
- feedback_vi: 3-6 gạch đầu dòng BẰNG TIẾNG VIỆT, cụ thể và hành động được ngay (trích 1-2 cụm thí sinh đã nói và gợi ý cách nói hay hơn khi phù hợp). Bắt đầu bằng 1 điểm mạnh, sau đó là điểm yếu theo thứ tự ưu tiên. Nói rõ điểm phát âm chỉ mang tính tương đối.

TRẢ VỀ ĐÚNG JSON theo shape này, không thêm chữ nào khác:
{"transcript":"...","scores":{"grammar":0,"vocabulary":0,"pronunciation":0,"fluency":0,"discourse_management":0},"feedback_vi":"..."}

Đề bài thí sinh nhận được:
${prompt}`;
}

async function transcribe(audio: File, apiKey: string): Promise<string> {
  // Try whisper-1 first, fall back to gpt-4o-transcribe.
  for (const model of ['whisper-1', 'gpt-4o-transcribe']) {
    const fd = new FormData();
    fd.append('file', audio, 'recording.webm');
    fd.append('model', model);
    fd.append('language', 'en');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    if (res.ok) {
      const data = await res.json();
      return (data.text || '').trim();
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('INVALID_KEY');
    }
    // Don't retry the fallback model on other client errors; a simple loop is
    // fine: if the second model also fails we throw below.
    if (model === 'gpt-4o-transcribe') {
      throw new Error(`Transcription failed (${res.status})`);
    }
  }
  throw new Error('Transcription failed');
}

interface LlmScore {
  scores: Record<string, unknown>;
  feedback_vi: string;
}

async function scoreWithOpenAI(
  transcript: string,
  part: number,
  prompt: string,
  apiKey: string
): Promise<LlmScore> {
  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SCORE_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt(part) },
        {
          role: 'user',
          content: `Task prompt given to the candidate:\n${prompt}\n\nTranscript of the candidate's speech:\n${transcript}`,
        },
      ],
    }),
  });
  if (!chatRes.ok) {
    if (chatRes.status === 401 || chatRes.status === 403) {
      throw new Error('INVALID_KEY');
    }
    throw new Error(`Scoring failed (${chatRes.status})`);
  }
  const chatData = await chatRes.json();
  const parsed = JSON.parse(chatData.choices?.[0]?.message?.content || '{}');
  return { scores: parsed.scores || {}, feedback_vi: String(parsed.feedback_vi || '') };
}

interface GeminiPart {
  text?: string;
}

async function scoreWithGemini(
  audio: File,
  part: number,
  prompt: string,
  apiKey: string
): Promise<{ transcript: string } & LlmScore> {
  const buf = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || 'audio/webm';
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: geminiPrompt(part, prompt) },
              { inlineData: { mimeType, data: buf.toString('base64') } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              transcript: { type: 'string' },
              scores: {
                type: 'object',
                properties: {
                  grammar: { type: 'number' },
                  vocabulary: { type: 'number' },
                  pronunciation: { type: 'number' },
                  fluency: { type: 'number' },
                  discourse_management: { type: 'number' },
                },
                required: [
                  'grammar',
                  'vocabulary',
                  'pronunciation',
                  'fluency',
                  'discourse_management',
                ],
              },
              feedback_vi: { type: 'string' },
            },
            required: ['transcript', 'scores', 'feedback_vi'],
          },
        },
      }),
    }
  );
  if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error('INVALID_KEY');
      }
      // 404 (model retired for this key) / 429 / 5xx → try the next model.
      lastError = `Gemini scoring failed (${res.status})`;
      continue;
    }
    const data = await res.json();
    const parts = (data.candidates?.[0]?.content?.parts || []) as GeminiPart[];
    const text = parts.map((p) => p.text || '').join('');
    const parsed = JSON.parse(text || '{}');
    return {
      transcript: String(parsed.transcript || '').trim(),
      scores: parsed.scores || {},
      feedback_vi: String(parsed.feedback_vi || ''),
    };
  }
  throw new Error(lastError || 'Gemini scoring failed');
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n * 2) / 2));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập bằng Google để chấm bài và lưu kết quả.' },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Không đọc được file ghi âm.' }, { status: 400 });
  }

  const audio = form.get('audio');
  const part = Number(form.get('part') || 0);
  const prompt = String(form.get('prompt') || '').slice(0, 2000);
  const formProvider = String(form.get('provider') || '').toLowerCase();
  // Client-supplied key (BYOK). Used transiently for this request only —
  // never logged, never written to DB, never persisted anywhere.
  const formKey = String(form.get('apiKey') || '').trim();

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'Thiếu file ghi âm.' }, { status: 400 });
  }
  if (![1, 2, 3].includes(part)) {
    return NextResponse.json({ error: 'Part không hợp lệ.' }, { status: 400 });
  }

  // Key resolution: client key first → server OPENAI_API_KEY fallback (openai only).
  let provider: Provider;
  let apiKey: string;
  if (formKey) {
    provider = formProvider === 'openai' ? 'openai' : 'gemini';
    apiKey = formKey;
  } else if (process.env.OPENAI_API_KEY) {
    provider = 'openai';
    apiKey = process.env.OPENAI_API_KEY;
  } else {
    return NextResponse.json(
      {
        error:
          'Chưa có API key để AI chấm Speaking. Vào trang Cài đặt để thêm key OpenAI hoặc Gemini của bạn — key chỉ lưu trong trình duyệt của bạn, server không giữ.',
      },
      { status: 503 }
    );
  }

  try {
    let transcript: string;
    let rawScores: Record<string, unknown>;
    let feedback: string;

    if (provider === 'gemini') {
      const out = await scoreWithGemini(audio, part, prompt, apiKey);
      transcript = out.transcript;
      rawScores = out.scores;
      feedback = out.feedback_vi;
    } else {
      // 1. Transcribe
      transcript = await transcribe(audio, apiKey);
      // 2. Score with the LLM
      const out = await scoreWithOpenAI(transcript, part, prompt, apiKey);
      rawScores = out.scores;
      feedback = out.feedback_vi;
    }

    if (!transcript) {
      return NextResponse.json(
        { error: 'Không nghe được nội dung bài nói. Hãy thử ghi âm lại, nói to và rõ hơn.' },
        { status: 422 }
      );
    }

    const scores: CriterionScores = {
      grammar: clampScore(rawScores.grammar),
      vocabulary: clampScore(rawScores.vocabulary),
      pronunciation: clampScore(rawScores.pronunciation),
      fluency: clampScore(rawScores.fluency),
      discourse_management: clampScore(rawScores.discourse_management),
    };
    const overall =
      Math.round(
        ((scores.grammar +
          scores.vocabulary +
          scores.pronunciation +
          scores.fluency +
          scores.discourse_management) /
          5) *
          2
      ) / 2;

    // 3. Persist (best effort — scoring result is returned even if DB is down)
    const sql = getSql();
    if (sql) {
      try {
        await ensureUser(sql, {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        });
        await sql`INSERT INTO speaking_sessions (user_id, part, prompt, transcript, scores, overall, feedback)
                  VALUES (${session.user.id}, ${part}, ${prompt}, ${transcript},
                          ${JSON.stringify(scores)}::jsonb, ${overall}, ${feedback})`;
      } catch (dbErr) {
        console.error('speaking score: db save failed:', dbErr);
      }
    }

    return NextResponse.json({ transcript, scores, overall, feedback_vi: feedback });
  } catch (err) {
    // Never include the API key in logs or error responses.
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'INVALID_KEY') {
      return NextResponse.json(
        { error: 'API key không hợp lệ hoặc đã hết hạn. Kiểm tra lại key trong trang Cài đặt.' },
        { status: 401 }
      );
    }
    console.error('speaking/score failed:', msg);
    return NextResponse.json(
      { error: 'Chấm bài thất bại. Hãy kiểm tra API key và thử lại.' },
      { status: 500 }
    );
  }
}
