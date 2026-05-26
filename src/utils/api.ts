import type { ParsedResult, Priority } from '../types';
import { parseAIInput } from './ai-parser';
import { parseDDLTextLocally } from './fallbackParser';

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
  tasks?: CompatibleAITask[];
}

interface CompatibleAITask {
  title?: string;
  deadline?: string;
  category?: string;
  priority?: string;
  description?: string;
  original_text?: string;
  originalText?: string;
  location?: string;
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
          "category": "category",
          "priority": "high|medium|low|normal",
          "description": "short note",
          "original_text": "source text related to this task",
          "location": "place, room, online meeting, or empty string"
        }
      ]
    }
  ]
}
Extract location from phrases like 地点, 位置, 于, 在, 前往, 到, 教室, 会议室, 图书馆, 操场, 体育馆, 实验楼, 教学楼, 学术报告厅, 线上, 腾讯会议, 飞书会议.
Use the current date as context. If no location is found, use an empty string.`;

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

function mapPriority(priority: string | undefined): Priority {
  const value = (priority || '').toLowerCase();
  if (value.includes('high') || value.includes('高')) return '高' as Priority;
  if (value.includes('low') || value.includes('低')) return '低' as Priority;
  return '中' as Priority;
}

function toDeadline(value: string | undefined): string {
  if (!value) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return value;
}

function toParsedResult(aiJSON: unknown, originalText: string): ParsedResult {
  const direct = aiJSON as CompatibleAITask & {
    projects?: CompatibleAIProject[];
    tasks?: CompatibleAITask[];
    ddls?: CompatibleAITask[];
    projectName?: string;
  };
  const directTasks = direct.tasks || direct.ddls || (direct.title ? [direct] : undefined);
  if (directTasks) {
    return {
      projectName: direct.projectName || direct.title || '未命名项目',
      category: direct.category || directTasks[0]?.category || '学习',
      ddls: directTasks.map((task) => ({
        title: task.title || '未命名任务',
        deadline: toDeadline(task.deadline),
        priority: mapPriority(task.priority),
        description: task.description || task.title || '',
        originalText: task.original_text || task.originalText || originalText,
        location: task.location || '',
      })),
      originalText,
      parseMode: 'ai',
    };
  }

  const projects = direct.projects || [];
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
      originalText: task.original_text || task.originalText || originalText,
      location: task.location || '',
    })),
    originalText,
    parseMode: 'ai',
  };
}

async function parseWithCompatibleAI(text: string, config: AIConfig): Promise<ParsedResult> {
  const response = await fetch(cleanBaseUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
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

export async function parseWithAI(text: string, userName: string): Promise<ParsedResult> {
  const status = getAIStatus();
  if (!status.configured) {
    return parseDDLTextLocally(text);
  }

  try {
    const result = await parseWithCompatibleAI(text, status.config);
    if (result.ddls.length > 0) return result;
    return await parseAIInput(text, userName);
  } catch (error) {
    console.warn('AI API unavailable, using fallback parser:', (error as Error).message);
    return parseDDLTextLocally(text);
  }
}
