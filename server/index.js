import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
const envPath = resolve(__dirname, '..', '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('[dotenv] Failed to load .env from:', envPath);
  console.error('[dotenv] Error:', envResult.error.message);
} else {
  console.log('[dotenv] Loaded .env from:', envPath);
  console.log('[dotenv] Keys loaded:', Object.keys(envResult.parsed || {}).join(', '));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

function getConfig() {
  return {
    API_KEY: process.env.AI_API_KEY || '',
    BASE_URL: process.env.AI_BASE_URL || '',
    MODEL: process.env.AI_MODEL || '',
  };
}

const PORT = parseInt(process.env.PORT || '3001', 10);

// ---- System Prompt ----

const SYSTEM_PROMPT = `你是DDL任务解析引擎。分析用户输入文本，提取任务信息并输出JSON。

## 文本类型识别
- 通知类：学校/团委/行政/单位通知 → 只提取核心可执行动作，最多5个任务，禁止逐句拆分
- 个人待办：直接的任务描述 → 逐条提取但合并语义相近项
- 列表类：编号列表 → 每条对应一个任务项

## 提取规则（关键）
1. 禁止将通知文本逐句拆分为任务。必须理解整个文本后归纳核心任务。
2. 忽略以下内容：
   - 通知套话：特此通知、请互相转告、现将...通知如下、根据...安排
   - 行政语言：请各单位、请督促、高度重视、积极组织
   - @提及、联系人信息、电话、邮箱
   - 规则约束：人数不超过X人、参赛对象为XX
   - 纯时间声明：初赛时间：XX、决赛时间：XX（这些是事件日期不是任务）
3. 合并语义相近的任务：
   - "提交项目申报书" 和 "交申报书" → 合并为1个任务
   - "准备商业计划书" 和 "准备路演PPT" → 如共享同一截止时间且语义相关，可合并为"准备商业计划书和路演PPT"
4. 提取项目名称：优先使用通知标题（以"通知""公告""安排""方案"结尾的行）
5. 提取截止时间：优先使用"截止时间""DDL""请于...前""X月X日前"等标记

## 时间解析（当前年份2026）
- "5月28日17:00前" → "2026-05-28 17:00"
- "5月20日前" → "2026-05-20 23:59"
- "今天/今晚" → 今天日期 23:59
- "明天" → 明天日期 23:59
- "后天" → 后天日期 23:59
- "大后天" → 大后天日期 23:59
- "周X前/本周X" → 本周X 23:59
- "X天后" → X天后 23:59
- 无明确时间 → "2026-06-01 23:59"

## 优先级判定
- high：24小时内截止 / 文本明确标注"紧急""尽快""马上""立即""ASAP""务必"
- medium：3天内截止（默认）
- low：3天后截止 / 文本标注"有空""不急""抽空"

## 输出格式（只输出JSON，不要markdown包裹，不要任何解释文字）
{
  "projects": [
    {
      "name": "项目名称",
      "deadline": "2026-05-28 17:00",
      "category": "比赛",
      "tasks": [
        {
          "title": "任务标题",
          "priority": "medium"
        }
      ]
    }
  ]
}

category 可选值：学习、工作、课程、比赛、社团、考试、生活`;

// ---- Category mapping ----

const CATEGORY_KEYWORDS = {
  '学习': ['学习', '复习', '作业', '论文', '阅读', '笔记', '自习', '图书馆'],
  '工作': ['工作', '实习', '面试', '简历', '任务', '项目', '报告', '周报'],
  '课程': ['课程', '上课', '课堂', '课件', 'PPT', '展示', 'pre', '汇报', '小组', '讨论'],
  '比赛': ['比赛', '竞赛', '挑战杯', '大创', '互联网+', '建模', '编程', '路演', '答辩'],
  '社团': ['社团', '活动', '招新', '例会', '团建', '聚餐', '晚会', '换届'],
  '考试': ['考试', '期末', '期中', '测验', '四级', '六级', '考研', '雅思', '托福', '教资', '公考'],
  '生活': ['体检', '看病', '搬家', '旅行', '聚会', '生日', '快递', '缴费', '办理'],
};

function detectCategory(text, aiCategory) {
  if (aiCategory && CATEGORY_KEYWORDS[aiCategory]) return aiCategory;
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([cat, keywords]) => {
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    return { cat, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].cat : '课程';
}

function mapPriority(p) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '中';
}

function toISO(dateStr) {
  if (!dateStr) {
    // Default: 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  // "2026-05-28 17:00" → "2026-05-28T17:00:00"
  const cleaned = dateStr.trim().replace(' ', 'T');
  if (cleaned.length === 16) return cleaned + ':00';
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) return cleaned;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
}

function extractJSON(text) {
  let cleaned = text.trim();
  // Remove markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Find JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return JSON.parse(cleaned);
}

// ---- API Route ----

app.post('/api/parse', async (req, res) => {
  const { text } = req.body;
  const requestId = Date.now().toString(36);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${requestId}] → POST /api/parse`);
  console.log(`[${requestId}] Text length: ${text?.length || 0} chars`);
  console.log(`[${requestId}] Text preview: ${text?.substring(0, 120)?.replace(/\n/g, '\\n')}...`);

  if (!text || !text.trim()) {
    console.log(`[${requestId}] ✗ Empty text, returning 400`);
    return res.status(400).json({ error: 'text is required' });
  }

  // --- API Key check ---
  const { API_KEY, BASE_URL, MODEL } = getConfig();

  console.log(`[${requestId}] Env file path: ${envPath}`);
  console.log(`[${requestId}] API_KEY present: ${!!API_KEY}`);
  console.log(`[${requestId}] API_KEY prefix: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'N/A'}`);
  console.log(`[${requestId}] BASE_URL: ${BASE_URL || 'N/A'}`);
  console.log(`[${requestId}] MODEL: ${MODEL || 'N/A'}`);

  if (!API_KEY || !BASE_URL || !MODEL) {
    console.log(`[${requestId}] ✗ AI not configured, returning 503`);
    return res.status(503).json({
      error: 'AI API not configured',
      hint: 'Set AI_API_KEY, AI_BASE_URL, and AI_MODEL in .env',
    });
  }

  // Construct full endpoint URL:
  // - If BASE_URL already ends with /chat/completions or /messages, use it directly
  // - Otherwise, assume it's a base URL and append /chat/completions
  let requestUrl = BASE_URL.replace(/\/$/, '');
  if (!requestUrl.endsWith('/chat/completions') && !requestUrl.endsWith('/messages')) {
    requestUrl += '/chat/completions';
  }

  try {
    const requestBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    };

    console.log(`[${requestId}] → Calling: POST ${requestUrl}`);
    console.log(`[${requestId}] Model: ${MODEL}`);
    console.log(`[${requestId}] Auth header: Bearer ${API_KEY.substring(0, 8)}...`);
    console.log(`[${requestId}] Request body size: ${JSON.stringify(requestBody).length} bytes`);

    const startTime = Date.now();
    const response = await axios.post(requestUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    const elapsed = Date.now() - startTime;

    console.log(`[${requestId}] ← Response status: ${response.status} (${elapsed}ms)`);
    console.log(`[${requestId}] Response data keys: ${Object.keys(response.data).join(', ')}`);

    // Log full response structure (without huge content)
    const choicesPreview = response.data.choices?.map(c => ({
      index: c.index,
      finish_reason: c.finish_reason,
      content_length: c.message?.content?.length,
    }));
    console.log(`[${requestId}] Choices: ${JSON.stringify(choicesPreview)}`);

    if (response.data.usage) {
      console.log(`[${requestId}] Token usage: ${JSON.stringify(response.data.usage)}`);
    }

    const aiText = response.data.choices?.[0]?.message?.content;
    if (!aiText) {
      console.log(`[${requestId}] ✗ No content in AI response. Full response: ${JSON.stringify(response.data).substring(0, 500)}`);
      throw new Error('No content in AI response');
    }

    console.log(`[${requestId}] AI raw response (first 300 chars):`);
    console.log(`[${requestId}]   ${aiText.substring(0, 300)?.replace(/\n/g, '\\n')}`);

    // Parse JSON from AI response
    let aiResult;
    try {
      aiResult = extractJSON(aiText);
      console.log(`[${requestId}] JSON parsed successfully`);
      console.log(`[${requestId}] Projects count: ${aiResult.projects?.length || 0}`);
      if (aiResult.projects?.[0]) {
        console.log(`[${requestId}] Project: "${aiResult.projects[0].name}" | Tasks: ${aiResult.projects[0].tasks?.length || 0}`);
      }
    } catch (parseErr) {
      console.log(`[${requestId}] ✗ JSON parse failed: ${parseErr.message}`);
      console.log(`[${requestId}] Raw text that failed parsing:\n${aiText}`);
      throw new Error(`Failed to parse AI response as JSON: ${parseErr.message}`);
    }

    const project = aiResult.projects?.[0];

    if (!project || !project.tasks || project.tasks.length === 0) {
      console.log(`[${requestId}] ⚠ No tasks extracted, returning empty result`);
      return res.json({
        projectName: project?.name || '未命名项目',
        category: detectCategory(text, project?.category),
        ddls: [],
        originalText: text,
      });
    }

    const parsedResult = {
      projectName: project.name || '未命名项目',
      category: detectCategory(text, project.category),
      ddls: project.tasks.map(task => ({
        title: task.title,
        deadline: toISO(task.deadline || project.deadline),
        priority: mapPriority(task.priority),
        description: task.title,
      })),
      originalText: text,
    };

    console.log(`[${requestId}] ✓ Returning ${parsedResult.ddls.length} tasks to frontend:`);
    parsedResult.ddls.forEach((d, i) => {
      console.log(`[${requestId}]   ${i + 1}. [${d.priority}] ${d.title} | ${d.deadline}`);
    });

    res.json(parsedResult);
  } catch (error) {
    console.log(`[${requestId}] ✗✗✗ REQUEST FAILED ✗✗✗`);
    console.log(`[${requestId}] Error type: ${error.constructor.name}`);
    console.log(`[${requestId}] Error message: ${error.message}`);

    if (error.response) {
      // The request was made and the server responded with a status code outside 2xx
      console.log(`[${requestId}] Response status: ${error.response.status}`);
      console.log(`[${requestId}] Response headers: ${JSON.stringify(error.response.headers)}`);
      console.log(`[${requestId}] Response data: ${JSON.stringify(error.response.data)?.substring(0, 1000)}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.log(`[${requestId}] No response received from server`);
      console.log(`[${requestId}] Request URL: ${requestUrl}`);
      console.log(`[${requestId}] Request details: ${error.request?.method || 'POST'} ${error.request?.path || ''}`);
    } else {
      // Something happened in setting up the request
      console.log(`[${requestId}] Request setup error`);
    }

    if (error.code) {
      console.log(`[${requestId}] Error code: ${error.code}`);
    }
    if (error.cause) {
      console.log(`[${requestId}] Error cause: ${JSON.stringify(error.cause)}`);
    }

    console.log(`[${requestId}] Full error stack: ${error.stack}`);

    res.status(500).json({
      error: 'AI parse failed',
      detail: error.message,
      code: error.code || 'UNKNOWN',
    });
  }
});

// ---- Health check ----

app.get('/api/health', (_req, res) => {
  const config = getConfig();
  res.json({
    status: 'ok',
    configured: !!(config.API_KEY && config.BASE_URL && config.MODEL),
    model: config.MODEL || 'not set',
    baseUrl: config.BASE_URL || 'not set',
  });
});

// ---- Start ----

app.listen(PORT, () => {
  const config = getConfig();
  console.log(`DDL Flow API → http://localhost:${PORT}`);
  console.log(`AI configured: ${!!(config.API_KEY && config.BASE_URL && config.MODEL)}`);
  console.log(`API_KEY: ${config.API_KEY ? config.API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
  console.log(`BASE_URL: ${config.BASE_URL || 'NOT SET'}`);
  console.log(`MODEL: ${config.MODEL || 'NOT SET'}`);
  if (!config.API_KEY || !config.BASE_URL || !config.MODEL) {
    console.log('Set AI_API_KEY, AI_BASE_URL, AI_MODEL in .env to enable AI parsing');
  }
});
