import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getPrompt } from './prompts'

type Bindings = {
  MY_BUCKET: R2Bucket
  DB: D1Database
  GEMINI_API_KEY: string
  DEEPSEEK_API_KEY: string
  ACCESS_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

// --- 1. Pages (GET /) ---
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI 英语作文双模型批改</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen p-4">
      <div class="max-w-5xl mx-auto bg-white p-6 md:p-10 rounded-xl shadow-xl border-t-4 border-blue-600">
        <h1 class="text-3xl font-extrabold mb-8 text-center text-gray-800 tracking-tight">
          📝 高考英语作文 <span class="text-blue-600">双模型</span> 智能批改
        </h1>
        
        <div class="space-y-6">
          <!-- Auth -->
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <label class="block text-sm font-bold text-blue-900 mb-2">🔐 访问密码 / Password</label>
            <input type="password" id="password" class="w-full border-gray-300 border p-3 rounded focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Enter Access Password">
          </div>

          <hr class="border-gray-200">

          <!-- Inputs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label class="block text-sm font-bold text-gray-700 mb-2">作文类型 / Type</label>
                <select id="type" class="w-full border border-gray-300 p-3 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="应用文">应用文 (Practical Writing)</option>
                    <option value="读后续写">读后续写 (Continuation Writing)</option>
                </select>
             </div>
             <div>
                <label class="block text-sm font-bold text-gray-700 mb-2">上传作文图片 / Photos (Max 3)</label>
                <input type="file" id="files" accept="image/*" multiple class="w-full border border-gray-300 p-2.5 rounded bg-white focus:ring-2 focus:ring-blue-500">
                <p class="text-xs text-gray-500 mt-1">支持上传 1-3 张清晰图片</p>
             </div>
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">题目要求 / Topic Requirements</label>
            <textarea id="topic" class="w-full border border-gray-300 p-4 rounded-lg h-36 focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm" placeholder="请粘贴完整的作文题目要求..."></textarea>
          </div>
          
          <button onclick="handleUpload()" id="btn" class="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition transform hover:scale-[1.01] font-bold text-lg shadow-lg">
            🚀 开始批改 (Start Grading)
          </button>
        </div>

        <!-- Working Status -->
        <div id="statusLogs" class="mt-6 hidden bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-32 overflow-y-auto"></div>

        <!-- Results -->
        <div id="resultArea" class="mt-10 hidden space-y-8">
          
          <!-- OCR Text -->
          <div class="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
             <h3 class="text-lg font-bold text-yellow-800 mb-2">👀 识别到的作文内容 (OCR Text)</h3>
             <pre id="ocrContent" class="whitespace-pre-wrap text-sm text-gray-800 font-mono"></pre>
          </div>

          <!-- Dual Result -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Gemini -->
            <div class="bg-green-50 rounded-lg border border-green-200 shadow-sm flex flex-col">
              <div class="p-4 border-b border-green-200 bg-green-100 rounded-t-lg flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-800">🤖 Gemini 1.5 Pro</h2>
                <span class="text-xs bg-green-600 text-white px-2 py-1 rounded">Fast & Creative</span>
              </div>
              <div id="geminiResult" class="p-6 prose prose-sm max-w-none overflow-auto flex-1 h-[600px]"></div>
            </div>

            <!-- DeepSeek -->
            <div class="bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm flex flex-col">
              <div class="p-4 border-b border-indigo-200 bg-indigo-100 rounded-t-lg flex justify-between items-center">
                <h2 class="text-xl font-bold text-indigo-800">🐳 DeepSeek V3</h2>
                <span class="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Logic & Reasoning</span>
              </div>
              <div id="deepseekResult" class="p-6 prose prose-sm max-w-none overflow-auto flex-1 h-[600px]"></div>
            </div>
          </div>

        </div>
      </div>

      <!-- Markdown Parser (Simple script for rendering) -->
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

      <script>
        const logArea = document.getElementById('statusLogs');
        const appendLog = (msg) => {
            logArea.classList.remove('hidden');
            const div = document.createElement('div');
            div.innerText = \`> [\${new Date().toLocaleTimeString()}] \${msg}\`;
            logArea.appendChild(div);
            logArea.scrollTop = logArea.scrollHeight;
        };

        async function handleUpload() {
          const pwd = document.getElementById('password').value;
          const files = document.getElementById('files').files;
          const topic = document.getElementById('topic').value;
          const type = document.getElementById('type').value;

          if (!pwd) return alert("❌ 请输入密码");
          if (files.length === 0 || files.length > 3) return alert("❌ 请上传 1-3 张图片");
          if (!topic) return alert("❌ 请输入题目");

          const btn = document.getElementById('btn');
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerText = "⏳ 处理中...";
          
          logArea.innerHTML = '';
          document.getElementById('resultArea').classList.add('hidden');
          appendLog("开始上传任务...");

          const formData = new FormData();
          for (let i = 0; i < files.length; i++) {
              formData.append('files', files[i]);
          }
          formData.append('topic', topic);
          formData.append('type', type);

          try {
            const res = await fetch('/api/grade', {
                method: 'POST',
                headers: { 'x-access-code': pwd },
                body: formData
            });

            if (res.status === 401) throw new Error("密码错误");
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || res.statusText);
            }

            const data = await res.json();
            
            appendLog("处理完成！渲染结果中...");
            
            document.getElementById('resultArea').classList.remove('hidden');
            
            // OCR
            document.getElementById('ocrContent').textContent = data.ocr_text;

            // Render Markdown
            document.getElementById('geminiResult').innerHTML = marked.parse(data.gemini_result);
            document.getElementById('deepseekResult').innerHTML = marked.parse(data.deepseek_result);

            appendLog("✅ 所有任务完成。");
            document.getElementById('statusLogs').classList.remove('hidden');

          } catch (e) {
            alert("Error: " + e.message);
            appendLog("❌ 错误: " + e.message);
          } finally {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.innerText = "🚀 开始批改 (Start Grading)";
          }
        }
      </script>
    </body>
    </html>
  `)
})

// --- 2. API (POST /api/grade) ---
app.post('/api/grade', async (c) => {
  const start = Date.now();

  // Auth
  if (c.req.header('x-access-code') !== c.env.ACCESS_PASSWORD) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.parseBody();
    const topic = body['topic'] as string;
    const type = body['type'] as string;

    // Handle files (Hono parseBody handles multiple files as array or single)
    let files: File[] = [];
    if (Array.isArray(body['files'])) {
      files = body['files'] as File[];
    } else if (body['files']) {
      files = [body['files'] as File];
    }

    if (files.length === 0 || !topic) {
      return c.json({ error: 'Missing files or topic' }, 400);
    }

    console.log(`Processing ${files.length} images...`);

    // 1. Parallel Upload to R2 & Base64 Conversion
    const uploadPromises = files.map(async (f, idx) => {
      const arrBuf = await f.arrayBuffer();
      const key = `essays/${Date.now()}_${idx}_${f.name}`;
      // Async upload, don't await strictly if speed needed, but safety first
      await c.env.MY_BUCKET.put(key, arrBuf);
      return {
        base64: btoa(String.fromCharCode(...new Uint8Array(arrBuf))),
        mime: f.type || 'image/jpeg'
      };
    });

    const fileDataList = await Promise.all(uploadPromises);

    // 2. OCR with Gemini Vision (handle multiple images in one req if possible, or join)
    // Gemini supports multiple images in inputs.
    const ocrText = await callGeminiOCR(c.env.GEMINI_API_KEY, fileDataList);

    console.log("OCR Completed length:", ocrText.length);

    // 3. Generate Prompt
    const gradePrompt = getPrompt(type, topic, ocrText);

    // 4. Parallel Grading (Gemini + DeepSeek)
    const [geminiRes, deepseekRes] = await Promise.all([
      callGeminiGrading(c.env.GEMINI_API_KEY, gradePrompt),
      callDeepSeekGrading(c.env.DEEPSEEK_API_KEY, gradePrompt)
    ]);

    // 5. Save Record
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO essays (timestamp, topic, essay_type, grade_result) VALUES (?, ?, ?, ?)"
      ).bind(new Date().toISOString(), topic, type, JSON.stringify({ gemini: geminiRes, deepseek: deepseekRes })).run()
    );

    return c.json({
      ocr_text: ocrText,
      gemini_result: geminiRes,
      deepseek_result: deepseekRes,
      duration: Date.now() - start
    });

  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || "Server Error" }, 500);
  }
});

// --- Helpers ---

async function callGeminiOCR(apiKey: string, images: { base64: string, mime: string }[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Construct parts: Text Instruction + Image1 + Image2 ...
  const parts: any[] = [
    { text: "Role: OCR Tool. Task: Identify the handwritten English text in these images. Output ONLY the text found, joined together. If images overlap, merge them logically. Do NOT correct grammar. Clarify the image virtually if it is blurry." }
  ];

  images.forEach(img => {
    parts.push({
      inline_data: {
        mime_type: img.mime,
        data: img.base64
      }
    });
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Gemini OCR Failed: ${response.status} - ${txt}`);
  }
  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiGrading(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  if (!response.ok) throw new Error(`Gemini Grading Failed`);
  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini Error";
}

async function callDeepSeekGrading(apiKey: string, prompt: string) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      stream: false,
      temperature: 1.0,
      max_tokens: 4000
    })
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`DeepSeek Grading Failed: ${txt}`);
  }
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "DeepSeek Error";
}

export default app
