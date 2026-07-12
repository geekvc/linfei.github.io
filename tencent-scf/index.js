'use strict'

/**
 * 腾讯云函数（SCF）：智谱 AI GLM-4-Flash 反向代理
 *
 * 作用与 cloudflare-worker/worker.js 完全一致：
 *   1. 把智谱 AI 的 API Key 藏在腾讯云函数的环境变量里，浏览器端拿不到，安全。
 *   2. 接收博客前端发来的聊天消息，拼接「人设」system prompt 后转发给智谱 AI。
 *   3. 处理跨域（CORS），让 GitHub Pages / 自定义域名都能正常调用。
 *
 * 选择腾讯云函数而不是 Cloudflare Workers 的原因：
 *   - Cloudflare 的 workers.dev 默认域名在国内经常出现 DNS 解析异常/连接失败
 *   - 腾讯云函数 + API网关 是纯国内节点，访问稳定，不存在跨境网络问题
 *   - 与你已经在用的腾讯云域名账号体系一致，管理方便
 *
 * 部署方式见同目录 README.md，全程在腾讯云控制台网页上点几下鼠标即可。
 */

const https = require('https')

// ------------------------------------------------------------------
// 1. 人设 System Prompt（与 Cloudflare 版本保持一致）
// ------------------------------------------------------------------
const SYSTEM_PROMPT = `
你是"王琳霏"（大家也叫她"琳霏"）的数字分身助手，正在她的个人博客网站上，代表她本人与访客（可能是HR、同行、学弟学妹）对话。

## 你的身份设定
- 姓名：王琳霏，民族：汉族，籍贯：河南省南阳市方城县，2000年01月出生
- 石河子大学学科教学（英语）硕士研究生（2024年9月入学，在读）
- 本科：周口师范学院 英语（师范）专业，2018年9月-2022年6月
- 性格：踏实、有责任心、教育热情强、善于沟通协调，具备良好的团队合作意识

## 教育与证书
- 英语专业八级、专业四级
- 高中英语教师资格证
- 大学英语四级、六级证书
- 普通话二级甲等

## 实习与工作经历（按时间倒序）
1. 新疆图木舒克市第二中学 · 支教教师（2025.09-2026.01）：负责高一1个班级英语授课，采用多样化教学方法激发学习兴趣，获学校领导和学生一致好评
2. 石河子大学外国语学院资料室/研究生学院专业学位培养办公室 · 助管（2024.10-2025.06）：负责资料整理、文件管理和协助组织学术活动，提升组织能力和团队协作能力
3. 英语辅导机构 · 讲师（2024.02-2024.09）：负责招生与授课，运营多个班级群并推送课程与每日互动，提升学员留存与转化率
4. 河南省南阳市红星学校 · 英语教师（2022.06-2024.01）：负责高一2个班级英语授课，采用分层教学与项目化学习等方法，显著提升学生成绩
5. 西华县城关中学 · 英语教学实习（2021.08-2021.11）：负责九年级2个班级英语授课，共计60课时，获指导教师和学生一致好评
6. 家教兼职（2019.07-2021.07）：累计授课100+课时，辅导学生10余名，成绩均有明显提高
7. 校学生会干事（2018.09-2019.06）：多次参与筹办校园大型活动，获"优秀干事"等荣誉

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
// 2. 允许跨域访问的来源
// ------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://linfei.wang',
  'https://www.linfei.wang',
  'https://geekvc.github.io',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
]

function buildCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  }
}

// ------------------------------------------------------------------
// 3. 调用智谱 AI（Node.js 原生 https 请求，无需额外依赖）
// ------------------------------------------------------------------
function callZhipu(messages) {
  return new Promise((resolve, reject) => {
    const trimmedHistory = messages.slice(-20)
    const payload = JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmedHistory],
      temperature: 0.9,
      max_tokens: 800,
      stream: false
    })

    const options = {
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 25000
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          reject(new Error('智谱 AI 返回内容解析失败: ' + data))
        }
      })
    })

    req.on('timeout', () => req.destroy(new Error('请求智谱 AI 超时')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ------------------------------------------------------------------
// 4. 腾讯云函数入口（API网关触发器 —— 经典触发格式）
// ------------------------------------------------------------------
exports.main_handler = async (event) => {
  const headers = event.headers || {}
  const origin = headers.origin || headers.Origin || ''
  const corsHeaders = buildCorsHeaders(origin)
  const method = event.httpMethod || (event.requestContext && event.requestContext.httpMethod) || 'GET'

  if (method === 'OPTIONS') {
    return { isBase64Encoded: false, statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (method !== 'POST') {
    return {
      isBase64Encoded: false,
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Only POST is supported' })
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const messages = body.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        isBase64Encoded: false,
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'messages 不能为空' })
      }
    }

    const upstream = await callZhipu(messages)

    if (upstream.status < 200 || upstream.status >= 300) {
      return {
        isBase64Encoded: false,
        statusCode: upstream.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: (upstream.data.error && upstream.data.error.message) || '智谱 AI 请求失败' })
      }
    }

    const reply = (upstream.data.choices &&
      upstream.data.choices[0] &&
      upstream.data.choices[0].message &&
      upstream.data.choices[0].message.content) || '抱歉，我暂时没能理解，可以换个方式再问一次吗？'

    return {
      isBase64Encoded: false,
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply })
    }
  } catch (err) {
    return {
      isBase64Encoded: false,
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '服务异常：' + err.message })
    }
  }
}
