// Cloudflare Pages - _worker.js (高级模式)
// 所有请求都由这个文件处理，和 Worker 写法完全一样

// CORS 响应头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 统一响应格式
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, code = -1, status = 400) {
  return jsonResponse({ code, message }, status);
}

function successResponse(data = null, message = 'success') {
  return jsonResponse({ code: 0, message, data });
}

// Supabase 查询封装
async function supabaseQuery(env, table, method, body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Supabase ${method} ${table} failed:`, res.status, errorText);
    throw new Error(`数据库操作失败: ${res.status}`);
  }
  return method === 'GET' ? await res.json() : true;
}

// 生成 UUID
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 获取客户端真实 IP
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') || 
         'unknown';
}

// 获取 User-Agent
function getUserAgent(request) {
  return request.headers.get('User-Agent') || 'unknown';
}

// 调用 DeepSeek AI
async function callDeepSeek(env, messages) {
  const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  
  const systemPrompt = `你是"理想的自己"——一个温暖、接纳、不批判的成长陪伴助手。
你的角色是用户理想中的自己，温柔而有力量。
请用温暖、共情、支持的语气回应用户，像一个知心朋友。
不要说教，不要评判，而是倾听、理解、陪伴。
每次回复不要太长，保持自然的对话节奏。
可以适当使用emoji增加亲切感。`;

  const requestMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: requestMessages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('DeepSeek API error:', res.status, errorText);
    throw new Error(`AI 服务异常: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// 处理 OPTIONS 预检请求
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// 初始化会话
async function handleSessionInit(request, env) {
  try {
    const { channel = 'default' } = await request.json();
    
    const sessionId = generateUUID();
    const userAgent = getUserAgent(request);
    const ipAddress = getClientIP(request);

    await supabaseQuery(env, 'sessions', 'POST', {
      session_id: sessionId,
      channel,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

    return successResponse({ sessionId }, '会话初始化成功');
  } catch (error) {
    console.error('Session init error:', error);
    return errorResponse('会话初始化失败: ' + error.message);
  }
}

// 事件上报
async function handleEvent(request, env) {
  try {
    const { sessionId, eventType, eventData = {} } = await request.json();

    if (!sessionId || !eventType) {
      return errorResponse('缺少必要参数: sessionId 或 eventType');
    }

    await supabaseQuery(env, 'events', 'POST', {
      session_id: sessionId,
      event_name: eventType,
      event_params: eventData,
    });

    return successResponse(null, '上报成功');
  } catch (error) {
    console.error('Event track error:', error);
    return errorResponse('上报失败: ' + error.message);
  }
}

// AI 对话
async function handleChat(request, env) {
  try {
    const { sessionId, userInput, messages = [] } = await request.json();

    if (!sessionId || !userInput) {
      return errorResponse('缺少必要参数: sessionId 或 userInput');
    }

    // 调用 AI
    const aiResponse = await callDeepSeek(env, messages);

    // 写入 feedbacks 表（失败不影响返回）
    try {
      await supabaseQuery(env, 'feedbacks', 'POST', {
        session_id: sessionId,
        user_input: userInput,
        ai_output: aiResponse,
      });
    } catch (dbError) {
      console.error('Write feedback failed:', dbError);
    }

    return successResponse({ content: aiResponse }, '对话成功');
  } catch (error) {
    console.error('Chat error:', error);
    return errorResponse('对话失败: ' + error.message, -1, 500);
  }
}

// 主入口
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 请求走后端逻辑
    if (path.startsWith('/api/') || path === '/api') {
      // 处理 OPTIONS 预检请求
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      // 健康检查
      if (path === '/' || path === '/api' || path === '/api/') {
        return successResponse(null, '服务运行正常');
      }

      // 本地模拟模式：只有显式设置 MOCK_MODE=1 时才生效。
      // 生产环境绝对不要配置 MOCK_MODE，否则会返回假数据。
      if (env.MOCK_MODE === '1') {
        if (request.method === 'POST' && path === '/api/session/init') {
          return successResponse({ sessionId: generateUUID() }, 'mock 会话初始化成功');
        }
        if (request.method === 'POST' && path === '/api/event') {
          const body = await request.json().catch(() => ({}));
          console.log('[mock event]', body.eventType, JSON.stringify(body.eventData || {}));
          return successResponse(null, 'mock 上报成功');
        }
        if (request.method === 'POST' && path === '/api/chat') {
          if (env.MOCK_CHAT_MODE === 'error') {
            return errorResponse('模拟 AI 故障', -1, 500);
          }
          if (env.MOCK_CHAT_MODE === 'slow') {
            await new Promise(resolve => setTimeout(resolve, 60000));
          }
          return successResponse(
            { content: '（本地模拟）我听见了。今天想聊点什么？' },
            'mock 对话成功'
          );
        }
      }

      // 路由分发
      if (request.method === 'POST') {
        if (path === '/api/session/init') {
          return handleSessionInit(request, env);
        }
        if (path === '/api/event') {
          return handleEvent(request, env);
        }
        if (path === '/api/chat') {
          return handleChat(request, env);
        }
      }

      // API 404
      return errorResponse('接口不存在', -1, 404);
    }

    // 非 API 请求，返回静态资源（前端页面）
    return env.ASSETS.fetch(request);
  }
};
