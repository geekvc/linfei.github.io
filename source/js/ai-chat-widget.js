/**
 * AI 数字分身悬浮聊天框
 * 纯前端实现，无框架依赖，兼容 Butterfly 主题的 pjax 局部刷新
 *
 * 使用前请先完成 /cloudflare-worker/README.md 里的部署步骤，
 * 并把下面的 API_ENDPOINT 换成你自己的 Cloudflare Worker 地址。
 */
(function () {
  'use strict'

  // TODO: 部署好 Cloudflare Worker 后，把下面这行换成你自己的 Worker 地址
  var API_ENDPOINT = 'https://linfei-ai-chat.YOUR_SUBDOMAIN.workers.dev'

  var WIDGET_ID = 'ai-chat-widget-root'
  var STORAGE_KEY = 'ai_chat_history_v1'
  var MAX_HISTORY = 20

  function el(tag, className, html) {
    var e = document.createElement(tag)
    if (className) e.className = className
    if (html !== undefined) e.innerHTML = html
    return e
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch (e) {
      return []
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)))
    } catch (e) { /* ignore */ }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function renderMessageText(text) {
    // 简单换行处理，避免引入 markdown 解析依赖
    return escapeHtml(text).replace(/\n/g, '<br>')
  }

  function initWidget() {
    if (document.getElementById(WIDGET_ID)) return // 避免 pjax 重复注入

    var root = el('div', 'ai-chat-widget')
    root.id = WIDGET_ID

    var toggleBtn = el('button', 'ai-chat-toggle', '<i class="fas fa-comment-dots"></i>')
    toggleBtn.setAttribute('aria-label', '和林飞的AI分身聊聊')
    toggleBtn.type = 'button'

    var panel = el('div', 'ai-chat-panel')
    panel.innerHTML =
      '<div class="ai-chat-header">' +
        '<div class="ai-chat-header-info">' +
          '<img class="ai-chat-avatar" src="/img/avatar.jpg" alt="avatar">' +
          '<div>' +
            '<div class="ai-chat-title">数字林飞</div>' +
            '<div class="ai-chat-subtitle">在线 · AI 分身 · 可询问求职/联系方式</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="ai-chat-close" aria-label="关闭"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="ai-chat-messages" id="ai-chat-messages"></div>' +
      '<div class="ai-chat-quick-replies" id="ai-chat-quick-replies">' +
        '<button type="button" class="ai-chat-quick-btn" data-text="可以介绍一下你自己吗？">自我介绍</button>' +
        '<button type="button" class="ai-chat-quick-btn" data-text="你的求职意向和联系方式是什么？">求职&联系方式</button>' +
        '<button type="button" class="ai-chat-quick-btn" data-text="你有哪些实习和项目经历？">实习经历</button>' +
      '</div>' +
      '<div class="ai-chat-input-row">' +
        '<textarea id="ai-chat-input" class="ai-chat-input" placeholder="输入消息，回车发送…" rows="1"></textarea>' +
        '<button type="button" class="ai-chat-send" id="ai-chat-send" aria-label="发送"><i class="fas fa-paper-plane"></i></button>' +
      '</div>'

    root.appendChild(panel)
    root.appendChild(toggleBtn)
    document.body.appendChild(root)

    var messagesEl = panel.querySelector('#ai-chat-messages')
    var inputEl = panel.querySelector('#ai-chat-input')
    var sendBtn = panel.querySelector('#ai-chat-send')
    var closeBtn = panel.querySelector('.ai-chat-close')
    var quickRepliesEl = panel.querySelector('#ai-chat-quick-replies')

    var history = loadHistory()
    var isOpen = false
    var isSending = false

    function appendMessage(role, text, opts) {
      opts = opts || {}
      var wrap = el('div', 'ai-chat-msg ai-chat-msg-' + role)
      var bubble = el('div', 'ai-chat-bubble', renderMessageText(text))
      wrap.appendChild(bubble)
      messagesEl.appendChild(wrap)
      messagesEl.scrollTop = messagesEl.scrollHeight
      return bubble
    }

    function renderHistory() {
      messagesEl.innerHTML = ''
      if (history.length === 0) {
        appendMessage('assistant', '你好呀 👋 我是「数字林飞」，可以问我关于学习经历、求职方向或者怎么联系到我～')
      } else {
        history.forEach(function (m) { appendMessage(m.role, m.content) })
      }
    }

    function setOpen(open) {
      isOpen = open
      panel.classList.toggle('ai-chat-panel-open', open)
      toggleBtn.classList.toggle('ai-chat-toggle-active', open)
      if (open) {
        renderHistory()
        setTimeout(function () { inputEl.focus() }, 200)
      }
    }

    toggleBtn.addEventListener('click', function () { setOpen(!isOpen) })
    closeBtn.addEventListener('click', function () { setOpen(false) })

    quickRepliesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.ai-chat-quick-btn')
      if (!btn) return
      inputEl.value = btn.getAttribute('data-text')
      sendMessage()
    })

    function autoResize() {
      inputEl.style.height = 'auto'
      inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px'
    }
    inputEl.addEventListener('input', autoResize)
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    })
    sendBtn.addEventListener('click', sendMessage)

    function sendMessage() {
      var text = inputEl.value.trim()
      if (!text || isSending) return

      if (API_ENDPOINT.indexOf('YOUR_SUBDOMAIN') !== -1) {
        appendMessage('assistant', '⚠️ AI 聊天服务尚未配置完成：请先按照 /cloudflare-worker/README.md 部署 Cloudflare Worker，并在 ai-chat-widget.js 中填入正确的 API_ENDPOINT。')
        return
      }

      inputEl.value = ''
      autoResize()

      appendMessage('user', text)
      history.push({ role: 'user', content: text })
      saveHistory(history)

      isSending = true
      var loadingBubble = appendMessage('assistant', '思考中…')
      loadingBubble.classList.add('ai-chat-loading')

      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      })
        .then(function (res) { return res.json() })
        .then(function (data) {
          loadingBubble.parentElement.remove()
          var reply = data.reply || data.error || '抱歉，出了点小问题，请稍后再试～'
          appendMessage('assistant', reply)
          history.push({ role: 'assistant', content: reply })
          saveHistory(history)
        })
        .catch(function () {
          loadingBubble.parentElement.remove()
          appendMessage('assistant', '网络似乎出了点问题，请稍后重试，或直接通过「关于我」页面的联系方式联系林飞～')
        })
        .finally(function () { isSending = false })
    }
  }

  // 兼容 Butterfly 的 pjax：每次页面局部刷新都尝试初始化（内部已做重复注入保护）
  document.addEventListener('DOMContentLoaded', initWidget)
  document.addEventListener('pjax:complete', initWidget)
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initWidget()
  }
})()
