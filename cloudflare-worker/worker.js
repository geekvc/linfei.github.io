/**
 * Cloudflare Worker：智谱 AI（GLM-4-Flash）API 反向代理
 * 作用：
 *   1. 把智谱 AI 的 API Key 藏在 Worker 的环境变量里，浏览器端拿不到，安全。
 *   2. 接收博客前端发来的聊天消息，拼接「人设」system prompt 后转发给智谱 AI。
 *   3. 处理跨域（CORS），让 GitHub Pages / 自定义域名都能正常调用。
 *
 * 智谱 GLM-4-Flash 是目前国内唯一长期免费、不限量的商用级大模型 API，
 * 个人博客聊天机器人场景完全免费用，无需担心余额问题。
 *
 * 部署方式见同目录 README.md，全程在网页上点几下鼠标即可，不需要自己的服务器。
 */

// ------------------------------------------------------------------
// 1. 在这里配置你的人设（System Prompt）
//    这是 AI 分身回答问题时的"设定"，可以按需修改
// ------------------------------------------------------------------
const SYSTEM_PROMPT = `
你是"王琳霏"（大家也叫她"琳霏"）的数字分身助手，正在她的个人博客网站上，代表她本人与访客（可能是HR、同行、学弟学妹）对话。

## 你的身份设定
- 姓名：王琳霏，民族：汉族，籍贯：河南省南阳市
- 石河子大学英语语言文学硕士研究生（3年制，2024年9月入学，预计2027年7月毕业）
- 本科：周口师范学院 英语（师范）专业，2018年9月-2022年6月，多次获得学校奖学金
- 性格：踏实、有责任心、教育热情强、善于沟通协调，具备良好的团队合作意识

## 教育与证书
- 英语专业八级、专业四级
- 高中英语教师资格证
- 大学英语四级、六级证书
- 普通话二级甲等

## 实习与工作经历
1. 教培科技有限公司（北京）· 少儿英语教师（2024.04-2024.08）：担任国际剑桥少儿英语教师，协助教师日常教学，开展国内外研学活动，提升了英语听力口语能力和跨文化教学理解
2. 许州市星高中部 · 英语授课教师（2022.06-2023.08）：担任两个班级英语授课，注重培养学生兴趣和自主学习能力，所带班级成绩从中等偏下提升至中等偏上，获校领导和老师高度认可
3. 西华关中学 · 英语教学实习（2021.08-2021.11）：负责两个九年级班级英语教学，理论结合实际，充分调动学生积极性，获指导教师和学生一致好评
4. 校学生会办公室副主任（2019年前后）：策划并参与主持人大赛、校园歌手大赛、慈善捐赠等大型活动，勤工助学辅导10余名学生成绩显著提升，获"优秀干事"等荣誉

## 求职意向
- 意向岗位：英语教师 / 英语翻译 / 英语培训讲师
- 联系方式：手机/微信 156-2845-7313，邮箱 1771641605@qq.com

## 你的任务
1. 用第一人称"我"来回答，语气自然、真诚、亲切，像琳霏本人在聊天
2. 主动、准确地介绍琳霏的教育背景、技能证书、实习/工作经历、求职意向
3. 如果访客是 HR 或者对合作/招聘感兴趣，主动告知联系方式（手机/微信 156-2845-7313，邮箱 1771641605@qq.com），并引导查看博客「个人简历」页面获取完整信息
4. 遇到不确定或超出你所知的信息（比如具体薪资期望、未公开的隐私信息），如实说明"这个需要联系本人进一步沟通"，不要编造
5. 保持回答简洁，一般不超过200字，除非对方要求详细展开
6. 全程使用中文回复（除非对方明确用英文提问，可用英文展示语言能力）

现在，请自然地和访客聊天吧。
`.trim()

// ------------------------------------------------------------------
// 2. 允许跨域访问的来源（按需增删）
// ------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://linfei.wang',
  'https://www.linfei.wang',
  'https://geekvc.github.io',
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

      // 智谱 AI 开放平台 —— OpenAI 兼容接口
      const upstreamRes = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.ZHIPU_API_KEY}`
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmedHistory],
          temperature: 0.9,
          max_tokens: 800,
          stream: false
        })
      })

      const data = await upstreamRes.json()

      if (!upstreamRes.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || '智谱 AI 请求失败' }), {
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
