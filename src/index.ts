import { Hono } from 'hono'
import { cors } from 'hono/cors'

// 定义环境变量的类型
type Bindings = {
  MY_BUCKET: R2Bucket
  DB: D1Database
  GEMINI_API_KEY: string
  DEEPSEEK_API_KEY: string
  ACCESS_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 允许跨域
app.use('/*', cors())

// --- 1. 前端页面路由 (GET /) ---
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI 英语作文批改助手</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-3xl w-full bg-white p-8 rounded-xl shadow-lg border-t-4 border-indigo-600">
        <h1 class="text-3xl font-bold mb-6 text-gray-800 text-center">📝 AI 英语作文智能批改</h1>
        
        <div class="space-y-6">
          <!-- 身份验证区域 -->
          <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <label class="block text-sm font-bold text-indigo-800 mb-2">🔐 访问密码 (必填)</label>
            <input type="password" id="password" class="w-full border border-gray-300 p-3 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="请输入管理员提供的访问密码">
          </div>

          <hr class="border-gray-200">

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label class="block text-sm font-medium mb-1 text-gray-700">作文类型</label>
                <select id="type" class="w-full border border-gray-300 p-3 rounded bg-white">
                    <option>应用文 (Application Letter)</option>
                    <option>读后续写 (Continuation Writing)</option>
                </select>
             </div>
             <div>
                <label class="block text-sm font-medium mb-1 text-gray-700">上传照片</label>
                <input type="file" id="file" accept="image/*" class="w-full border border-gray-300 p-2.5 rounded bg-white">
             </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">题目要求 / Prompt</label>
            <textarea id="topic" class="w-full border border-gray-300 p-3 rounded h-32 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如：假定你是李华，你的英国朋友Peter..."></textarea>
          </div>
          
          <button onclick="handleUpload()" id="btn" class="w-full bg-indigo-600 text-white py-4 rounded-lg hover:bg-indigo-700 transition font-bold text-lg shadow-md">开始智能批改</button>
        </div>

        <!-- 结果展示区 -->
        <div id="result" class="mt-10 hidden animate-fade-in">
          <div class="flex justify-between items-center mb-4 border-b pb-3">
            <h2 class="text-2xl font-bold text-gray-800">📊 批改报告</h2>
            <button onclick="downloadMd()" class="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded transition text-gray-700">
                <span>📥</span> 下载 Markdown
            </button>
          </div>
          <!-- Markdown 内容容器 -->
          <div id="markdownContent" class="prose prose-indigo max-w-none bg-gray-50 p-6 rounded-lg border border-gray-200 overflow-auto text-sm whitespace-pre-wrap font-mono leading-relaxed"></div>
        </div>
      </div>

      <script>
        let lastResult = "";
        
        async function handleUpload() {
          const pwd = document.getElementById('password').value;
          const btn = document.getElementById('btn');
          const fileInput = document.getElementById('file');
          const topic = document.getElementById('topic').value;
          const type = document.getElementById('type').value;

          if (!pwd) return alert("❌ 请输入访问密码");
          if (!fileInput.files[0] || !topic) return alert("❌ 请上传图片并填写题目");

          // UI Loading 状态
          const originalText = btn.innerText;
          btn.innerText = "⏳ 正在上传图片并进行 AI 分析...";
          btn.classList.add("opacity-60", "cursor-not-allowed");
          btn.disabled = true;

          const formData = new FormData();
          formData.append('file', fileInput.files[0]);
          formData.append('topic', topic);
          formData.append('type', type);

          try {
            const res = await fetch('/api/grade', { 
              method: 'POST', 
              headers: {
                'x-access-code': pwd // 密码通过 Header 传输
              },
              body: formData 
            });

            if (res.status === 401) throw new Error("密码错误，拒绝访问");
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "服务器处理失败");
            }

            const data = await res.json();
            
            // 显示结果
            document.getElementById('result').classList.remove('hidden');
            document.getElementById('markdownContent').textContent = data.result;
            lastResult = data.result;
            
            // 滚动到结果区
            setTimeout(() => {
                document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
            }, 100);

          } catch(e) {
            alert("⚠️ 发生错误: " + e.message);
          } finally {
            btn.innerText = originalText;
            btn.classList.remove("opacity-60", "cursor-not-allowed");
            btn.disabled = false;
          }
        }

        function downloadMd() {
          if (!lastResult) return;
          const blob = new Blob([lastResult], {type: 'text/markdown'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = \`Essay_Correction_\${new Date().toISOString().slice(0,10)}.md\`;
          a.click();
        }
      </script>
    </body>
    </html>
  `)
})

// --- 2. 核心 API 路由 (POST /api/grade) ---
app.post('/api/grade', async (c) => {
  // A. 安全校验
  const clientPassword = c.req.header('x-access-code')
  const serverPassword = c.env.ACCESS_PASSWORD

  if (!clientPassword || clientPassword !== serverPassword) {
    return c.json({ error: 'Unauthorized: Incorrect Password' }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const file = body['file'] as File
    const topic = body['topic'] as string
    const type = body['type'] as string

    if (!file || !topic) return c.json({ error: 'Missing file or topic' }, 400)

    // B. 处理文件并上传到 R2
    const arrayBuffer = await file.arrayBuffer()
    const imageKey = `essays/${Date.now()}_${file.name}`
    
    // 异步上传 R2 (不阻塞后续流程，但这里为了逻辑简单我们await它，或者也可以用waitUntil)
    await c.env.MY_BUCKET.put(imageKey, arrayBuffer)

    // C. 图片转 Base64 准备给 Gemini OCR
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    
    // D. 调用 Gemini 进行 OCR 识别
    const ocrText = await callGeminiVision(c.env.GEMINI_API_KEY, base64Image)

    // E. 调用 DeepSeek 进行作文批改
    const gradingResult = await callDeepSeek(c.env.DEEPSEEK_API_KEY, type, topic, ocrText)

    // F. 数据存入 D1 数据库 (使用 waitUntil 异步执行，加快响应)
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO essays (timestamp, topic, image_key, essay_type, grade_result) VALUES (?, ?, ?, ?, ?)"
      ).bind(new Date().toISOString(), topic, imageKey, type, gradingResult).run()
    )

    // G. 返回结果
    return c.json({ 
      success: true,
      ocr_text: ocrText,
      result: gradingResult 
    })

  } catch (error: any) {
    console.error(error)
    return c.json({ error: error.message || "Internal Server Error" }, 500)
  }
})

// --- 3. 辅助函数：Gemini 视觉识别 ---
async function callGeminiVision(apiKey: string, base64Image: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: "Role: OCR Tool. Task: Transcribe the handwriting in this image into English text exactly as it appears. Do not correct grammar. Do not explain. Just output the text." },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "(OCR 识别失败，未能提取到文字)";
}

// --- 4. 辅助函数：DeepSeek 批改 ---
async function callDeepSeek(apiKey: string, type: string, topic: string, content: string) {
  const prompt = `
    Role: Senior English Teacher for China's Gaokao.
    Task: Grade the following student essay.
    
    [Essay Info]
    Type: ${type}
    Topic: ${topic}
    Student's Content (from OCR):
    "${content}"
    
    [Requirements]
    Please output the result in STRICT MARKDOWN format.
    
    Structure:
    # 英语作文批改报告
    ## 1. 评分预估 (Total 25)
    - **Score**: [Score]/25
    - **Level**: [Level Description]
    
    ## 2. 整体点评
    (Brief summary in Chinese)
    
    ## 3. 逐句修正 (Correction Table)
    | 原文 (Original) | 修正 (Correction) | 解释/亮点 (Analysis) |
    |---|---|---|
    | ... | ... | ... |
    
    ## 4. 提升建议
    - (Point 1)
    - (Point 2)
    
    ## 5. 范文重写 (Model Essay)
    (A polished version based on student's idea)
  `;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat", // DeepSeek V3
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 2000
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API Error: ${response.statusText}`);
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "(生成失败)";
}

export default app
