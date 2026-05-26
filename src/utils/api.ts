import type { ParsedResult, Priority } from '../types';
import { parseAIInput } from './ai-parser';
import dayjs from 'dayjs';

const AI_CONFIG_KEY = 'ddlflow_ai_config';

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AIStatus {
  configured: boolean;
  config: AIConfig;
}

interface CompatibleAIProject {
  name?: string;
  deadline?: string;
  category?: string;
  tasks?: Array<{
    title?: string;
    deadline?: string;
    priority?: string;
    description?: string;
  }>;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: '',
  apiKey: '',
  model: 'deepseek-chat',
};

const AI_SYSTEM_PROMPT = `You extract DDL/deadline tasks from user text.
Return only valid JSON, no markdown.
JSON shape:
{
  "projects": [
    {
      "name": "project name",
      "deadline": "YYYY-MM-DDTHH:mm:ss",
      "category": "学习|工作|课程|比赛|社团|考试|生活",
      "tasks": [
        {
          "title": "task title",
          "deadline": "YYYY-MM-DDTHH:mm:ss",
          "priority": "high|medium|low",
          "description": "short note"
        }
      ]
    }
  ]
}
Use the current date as context. If a deadline is unclear, infer a reasonable deadline.`;

function cleanBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function parseStoredAIConfig(raw: string | null): AIConfig {
  if (!raw) return DEFAULT_AI_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    return {
      baseUrl: parsed.baseUrl || '',
      apiKey: parsed.apiKey || '',
      model: parsed.model || DEFAULT_AI_CONFIG.model,
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export function loadAIConfig(): AIConfig {
  return parseStoredAIConfig(localStorage.getItem(AI_CONFIG_KEY));
}

export function saveAIConfig(config: AIConfig): void {
  const normalized = {
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim() || DEFAULT_AI_CONFIG.model,
  };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('ddlflow-ai-config-updated'));
}

export function getAIStatus(): AIStatus {
  const config = loadAIConfig();
  return {
    config,
    configured: Boolean(config.baseUrl.trim() && config.apiKey.trim()),
  };
}

function extractJSON(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

function mapPriority(priority: string | undefined) {
  const value = (priority || '').toLowerCase();
  if (value.includes('high') || value.includes('高')) return '高';
  if (value.includes('low') || value.includes('低')) return '低';
  return '中';
}

function toDeadline(value: string | undefined): string {
  if (!value) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return value;
}

function parseSimpleDeadline(text: string): string | null {
  const now = dayjs();
  const normalized = text.trim();
  if (/今天|今日|今晚/.test(normalized)) return now.hour(23).minute(59).second(0).toISOString();
  if (/明天|明日/.test(normalized)) return now.add(1, 'day').hour(23).minute(59).second(0).toISOString();
  if (/后天/.test(normalized)) return now.add(2, 'day').hour(23).minute(59).second(0).toISOString();

  const weekdayMatch = normalized.match(/(?:本周|这周|周|星期)([一二三四五六日天])/);
  if (weekdayMatch) {
    const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
    const target = map[weekdayMatch[1]];
    let diff = target - now.day();
    if (diff < 0) diff += 7;
    return now.add(diff, 'day').hour(23).minute(59).second(0).toISOString();
  }

  const monthDayMatch = normalized.match(/(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*(?:日|号)?/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const date = Number(monthDayMatch[2]);
    const year = month < now.month() + 1 ? now.year() + 1 : now.year();
    return dayjs(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)
      .hour(23).minute(59).second(0).toISOString();
  }

  return null;
}

function detectSimpleCategory(text: string): string {
  if (/作业|高数|数学|课程|论文|复习|预习|考试|实验|课堂|学习/.test(text)) return '学习';
  if (/工作|会议|周报|日报|汇报|面试|实习|项目/.test(text)) return '工作';
  if (/比赛|竞赛|答辩|路演|报名|参赛/.test(text)) return '比赛';
  if (/社团|活动|招新|团建/.test(text)) return '社团';
  if (/体检|缴费|聚会|旅行|生活|生日/.test(text)) return '生活';
  return '学习';
}

function detectSimplePriority(text: string, deadline: string): Priority {
  if (/紧急|重要|马上|尽快|立刻|今天|今晚|ASAP/i.test(text)) return '高' as Priority;
  if (/不急|有空|随便|抽空/.test(text)) return '低' as Priority;
  const hours = dayjs(deadline).diff(dayjs(), 'hour');
  if (hours <= 24) return '高' as Priority;
  if (hours > 72) return '低' as Priority;
  return '中' as Priority;
}

function cleanSimpleTitle(line: string): string {
  return line
    .replace(/(?:今天|今日|今晚|明天|明日|后天|本周|这周|周|星期)[一二三四五六日天]?(?:前|之前|截止|提交|完成)?/g, '')
    .replace(/\d{1,2}\s*[月/-]\s*\d{1,2}\s*(?:日|号)?(?:前|之前|截止)?/g, '')
    .replace(/(前|之前|截止|完成|提交|ddl|DDL|deadline)$/g, '')
    .replace(/^[,，。；;:\s]+|[,，。；;:\s]+$/g, '')
    .trim();
}

async function parseFallbackInput(text: string, userName: string): Promise<ParsedResult> {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const sourceLines = lines.length > 0 ? lines : [text.trim()];
  const fallbackDeadline = dayjs().add(7, 'day').hour(23).minute(59).second(0).toISOString();
  const category = detectSimpleCategory(text);
  const ddls = sourceLines.map((line) => {
    const deadline = parseSimpleDeadline(line) || fallbackDeadline;
    const title = cleanSimpleTitle(line) || line.slice(0, 50) || '未命名任务';
    return {
      title,
      deadline,
      priority: detectSimplePriority(line, deadline),
      description: line,
    };
  });

  if (ddls.length > 0) {
    return {
      projectName: ddls[0].title,
      category,
      ddls,
      originalText: text,
    };
  }

  return await parseAIInput(text, userName);
}

function toParsedResult(aiJSON: unknown, originalText: string): ParsedResult {
  const projects = (aiJSON as { projects?: CompatibleAIProject[] }).projects || [];
  const project = projects[0] || {};
  const tasks = project.tasks || [];
  return {
    projectName: project.name || '未命名项目',
    category: project.category || '学习',
    ddls: tasks.map((task) => ({
      title: task.title || '未命名任务',
      deadline: toDeadline(task.deadline || project.deadline),
      priority: mapPriority(task.priority),
      description: task.description || task.title || '',
    })),
    originalText,
  };
}

async function parseWithCompatibleAI(text: string, config: AIConfig): Promise<ParsedResult> {
  const response = await fetch(cleanBaseUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_AI_CONFIG.model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: `Current date: ${new Date().toISOString().slice(0, 10)}\n\n${text}` },
      ],
      temperature: 0.2,
      max_tokens: 1600,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API returned ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI API response has no message content');
  return toParsedResult(extractJSON(content), text);
}

export async function parseWithAI(text: string, _userName: string): Promise<ParsedResult> {
  const status = getAIStatus();
  if (!status.configured) {
    return await parseFallbackInput(text, _userName);
  }

  try {
    const result = await parseWithCompatibleAI(text, status.config);
    if (result.ddls.length > 0) return result;
    return await parseAIInput(text, _userName);
  } catch (error) {
    console.warn('AI API unavailable, using fallback parser:', (error as Error).message);
    return await parseFallbackInput(text, _userName);
  }
}
