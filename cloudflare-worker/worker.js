/**
 * Cloudflare Worker：DeepSeek API 反向代理
 * 作用：
 *   1. 把 DeepSeek 的 API Key 藏在 Worker 的环境变量里，浏览器端拿不到，安全。
 *   2. 接收博客前端发来的聊天消息，拼接「人设」system prompt 后转发给 DeepSeek。
 *   3. 处理跨域（CORS），让 GitHub Pages / 自定义域名都能正常调用。
 *
 * 部署方式见同目录 README.md，全程在网页上点几下鼠标即可，不需要自己的服务器。
 */

// ------------------------------------------------------------------
// 1. 在这里配置你的人设（System Prompt）
//    这是 AI 分身回答问题时的"设定"，可以按需修改
// ------------------------------------------------------------------
const SYSTEM_PROMPT = `
你是"林飞"的数字分身助手，正在林飞的个人博客网站上，代表林飞本人与访客（可能是HR、同行、学弟学妹）对话。

## 你的身份设定
- 林飞，石河子大学英语专业硕士研究生（在读/求职中）
- 研究方向：英语语言文学 / 翻译理论与实践（请根据本人实际情况修改）
- 性格：踏实、认真、乐于分享，专业能力扎实，善于跨文化沟通
- 语言能力：CATTI 笔译/口译证书、专业八级（请按实际修改）
- 求职意向：英语教师 / 翻译 / 内容编辑 / 英语培训讲师等相关岗位（请按实际修改）

## 你的任务
1. 用第一人称"我"来回答，语气自然、真诚、专业，像林飞本人在聊天
2. 主动、准确地介绍林飞的教育背景、技能特长、实习经历、求职意向
3. 如果访客是 HR 或者对合作/招聘感兴趣，主动引导对方留下联系方式，或告知联系林飞的方式（邮箱等，具体信息见博客"关于我"和"个人简历"页面）
4. 如果被问到简历详情，可以引导访客查看博客的"个人简历"页面获取完整信息
5. 遇到不确定或超出你所知的信息（比如具体薪资期望、未公开的隐私信息），如实说明"这个需要联系本人进一步沟通"，不要编造
6. 保持回答简洁，一般不超过200字，除非对方要求详细展开
7. 全程使用中文回复（除非对方明确用英文提问，可用英文展示语言能力）

现在，请自然地和访客聊天吧。
`.trim()

// ------------------------------------------------------------------
// 2. 允许跨域访问的来源（按需增删）
// ------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://linfei.wang',
  'https://www.linfei.wang',
  // 部署到 GitHub Pages 后，把下面替换成你的实际 github.io 地址
  'https://your-github-username.github.io',
  // 本地预览调试用
  'http://localhost:4000',
  'http://127.0.0.1:4000'
]

function buildCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const corsHeaders = buildCorsHeaders(origin)

    // 处理浏览器的 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Only POST is supported', { status: 405, headers: corsHeaders })
    }

    try {
      const { messages } = await request.json()

      if (!Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ error: 'messages 不能为空' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 限制单次请求携带的历史消息条数，避免 token 消耗过大
      const trimmedHistory = messages.slice(-20)

      const upstreamRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmedHistory],
          temperature: 1.2,
          max_tokens: 800,
          stream: false
        })
      })

      const data = await upstreamRes.json()

      if (!upstreamRes.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || 'DeepSeek API 请求失败' }), {
          status: upstreamRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时没能理解，可以换个方式再问一次吗？'

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: '服务异常：' + err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}
