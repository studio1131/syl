// ====================================================================
// SYLHERA ENHANCEMENTS
// Loads CMS content from Sanity then builds Playground, Fragments,
// Totems, and wires up the Contact form.
// Falls back to hardcoded data when Sanity is not configured.
// ====================================================================

// ==================== HELPERS ====================

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ==================== SANITY CONTENT LOADER ====================

var SANITY_CONTENT = null

async function loadSanityContent() {
  try {
    var res = await fetch('/api/content')
    if (!res.ok) return null
    var data = await res.json()
    SANITY_CONTENT = data
    return data
  } catch (e) {
    return null
  }
}

function portableTextToHtml(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks.map(function (block) {
    if (!block || block._type !== 'block') return ''
    var text = (block.children || []).map(function (child) {
      var t = (child.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      var marks = child.marks || []
      if (marks.indexOf('strong') > -1) t = '<strong>' + t + '</strong>'
      if (marks.indexOf('em')     > -1) t = '<em>' + t + '</em>'
      if (marks.indexOf('code')   > -1) t = '<code>' + t + '</code>'
      return t
    }).join('')
    switch (block.style) {
      case 'h2':         return '<h2>' + text + '</h2>'
      case 'h3':         return '<h3>' + text + '</h3>'
      case 'blockquote': return '<blockquote>' + text + '</blockquote>'
      default:           return '<p>' + text + '</p>'
    }
  }).join('\n')
}

function fmtDate(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n
}

// ==================== SITE SETTINGS ====================

function applySiteSettings(s) {
  if (!s) return
  if (s.faviconUrl) {
    var fav = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']")
    if (fav) {
      fav.href = s.faviconUrl
    } else {
      var link = document.createElement('link')
      link.rel = 'icon'
      link.href = s.faviconUrl
      document.head.appendChild(link)
    }
  }
  if (s.logoUrl) {
    var img = document.querySelector('.n-mark img')
    if (img) img.src = s.logoUrl
  }
  if (s.siteTitle) {
    var logoText = document.querySelector('.n-logo')
    if (logoText) {
      var mark = logoText.querySelector('.n-mark')
      logoText.textContent = s.siteTitle
      if (mark) logoText.prepend(mark)
    }
  }
}

// ==================== HOMEPAGE IMAGES ====================

function applyHomepageImages(images) {
  if (!images || !images.length) return
  var cells = document.querySelectorAll('#pg-home .ab-cell')
  images.forEach(function (img, idx) {
    if (!cells[idx] || !img.imageUrl) return
    var artEl = cells[idx].querySelector('.ab-art-img, .ab-art')
    if (artEl) {
      artEl.className = 'ab-art-img'
      artEl.innerHTML = '<img src="' + esc(img.imageUrl) + '" alt="' + esc(img.title || '') + '" style="width:100%;height:100%;object-fit:cover;display:block;">'
    }
    var tagEl   = cells[idx].querySelector('.ab-tag')
    var titleEl = cells[idx].querySelector('.ab-title')
    if (tagEl   && img.tag)   tagEl.textContent   = img.tag
    if (titleEl && img.title) titleEl.textContent = img.title
  })
}

// ==================== UNIVERSE IMAGES ====================

function applyUniverseImages(images) {
  if (!images || !images.length) return
  var masonry = document.getElementById('univ-masonry')
  if (!masonry) return
  masonry.innerHTML = ''
  images.forEach(function (img) {
    var item = document.createElement('div')
    item.className = 'univ-item univ-item-img'
    item.style.position = 'relative'
    item.innerHTML =
      '<img src="' + esc(img.imageUrl) + '" alt="' + esc(img.title || '') + '" style="width:100%;display:block;">' +
      '<div class="univ-cap">' + esc(img.caption || img.title || '') + '</div>'
    item.addEventListener('mouseenter', function () { if (typeof ch === 'function') ch(true)  })
    item.addEventListener('mouseleave', function () { if (typeof ch === 'function') ch(false) })
    masonry.appendChild(item)
  })
}

// ==================== AUDIO PLAYER (PLAYGROUND) ====================

var TRACKS_FALLBACK = [
  { n:'01', ti:'Nuit Magnétique',  ge:'Dark Ambient',   dk:true,  duration:222, url:'' },
  { n:'02', ti:'Carnivore Dreams', ge:'Experimental',   dk:false, duration:198, url:'' },
  { n:'03', ti:'Third Eye Opening',ge:'Drone / Ritual', dk:true,  duration:245, url:'' },
  { n:'04', ti:'Immensité',        ge:'Ambient',        dk:false, duration:312, url:'' },
  { n:'05', ti:'Vanitas Echo',     ge:'Sound Art',      dk:true,  duration:178, url:'' },
  { n:'06', ti:'Visage Brut',      ge:'Industrial',     dk:false, duration:256, url:'' },
  { n:'07', ti:'Masque Ceremony',  ge:'Ritual Ambient', dk:true,  duration:289, url:'' },
  { n:'08', ti:'Stellar Descent',  ge:'Experimental',   dk:false, duration:201, url:'' },
  { n:'09', ti:'Pulse of Stone',   ge:'Dark Ambient',   dk:true,  duration:234, url:'' }
]

var currentlyPlaying  = -1
var audioObjects      = {}
var progressInterval  = null
var ACTIVE_TRACKS     = TRACKS_FALLBACK

function formatTime(seconds) {
  seconds = Math.floor(seconds) || 0
  return Math.floor(seconds / 60) + ':' + pad2(seconds % 60)
}

function buildPlay() {
  var grid = document.getElementById('mgrid')
  if (!grid) return
  grid.innerHTML = ''
  audioObjects = {}
  currentlyPlaying = -1

  ACTIVE_TRACKS = (SANITY_CONTENT && SANITY_CONTENT.tracks && SANITY_CONTENT.tracks.length)
    ? SANITY_CONTENT.tracks.map(function (t, i) {
        return {
          n:        t.trackNumber || pad2(i + 1),
          ti:       t.title,
          ge:       t.genre || '',
          dk:       !!t.dark,
          duration: t.duration || 0,
          url:      t.audioUrl || ''
        }
      })
    : TRACKS_FALLBACK

  ACTIVE_TRACKS.forEach(function (t, i) {
    var track = document.createElement('div')
    track.className = 'track' + (t.dk ? ' dk' : '')
    track.dataset.index = i

    var waveHtml = '<div class="t-wave">'
    for (var b = 0; b < 24; b++) {
      waveHtml += '<div class="t-b" style="height:' + (20 + Math.random() * 80) + '%"></div>'
    }
    waveHtml += '</div>'

    var durStr = t.duration > 0 ? formatTime(t.duration) : '--:--'

    track.innerHTML =
      '<div class="t-n">'  + t.n  + '</div>' +
      '<div class="t-ti">' + t.ti + '</div>' +
      '<div class="t-ge">' + t.ge + '</div>' +
      waveHtml +
      '<div class="t-foot">' +
        '<button class="t-pl" onclick="togglePlay(' + i + ')">' +
          '<svg class="t-pi" width="12" height="12" viewBox="0 0 12 12">' +
            '<path d="M3 2 L3 10 L9 6 Z" fill="currentColor"/>' +
          '</svg>' +
        '</button>' +
        '<div class="t-du" id="duration-' + i + '">0:00 / ' + durStr + '</div>' +
        '<div class="t-tg">' + (t.ge.split(' ')[0] || '') + '</div>' +
      '</div>' +
      '<div class="t-prog" id="prog-' + i + '"></div>'

    track.addEventListener('mouseenter', function () { if (typeof ch === 'function') ch(true)  })
    track.addEventListener('mouseleave', function () { if (typeof ch === 'function') ch(false) })
    grid.appendChild(track)
  })
}

function getAudioObj(idx) {
  var t = ACTIVE_TRACKS[idx]
  if (!t || !t.url) return null
  if (!audioObjects[idx]) {
    var audio = new Audio(t.url)
    audio.addEventListener('timeupdate', function () {
      if (currentlyPlaying !== idx) return
      var dur = audio.duration || t.duration || 1
      var pct = (audio.currentTime / dur) * 100
      var p = document.getElementById('prog-' + idx)
      var d = document.getElementById('duration-' + idx)
      if (p) p.style.width = pct + '%'
      if (d) d.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(dur)
      setMiniPlayerFill(pct)
      setMiniPlayerTime(audio.currentTime, dur)
    })
    audio.addEventListener('ended', function () {
      var trackEls = document.querySelectorAll('.track')
      if (trackEls[idx]) trackEls[idx].classList.remove('playing')
      updatePlayButton(idx, false)
      var p = document.getElementById('prog-' + idx)
      if (p) p.style.width = '0%'
      currentlyPlaying = -1
      hideMiniPlayer()
    })
    audioObjects[idx] = audio
  }
  return audioObjects[idx]
}

function togglePlay(idx) {
  var trackEls = document.querySelectorAll('.track')

  if (currentlyPlaying === idx) {
    var a = getAudioObj(idx)
    if (a) a.pause(); else clearInterval(progressInterval)
    trackEls[idx].classList.remove('playing')
    currentlyPlaying = -1
    updatePlayButton(idx, false)
    return
  }

  if (currentlyPlaying >= 0) {
    var prev = getAudioObj(currentlyPlaying)
    if (prev) prev.pause(); else clearInterval(progressInterval)
    trackEls[currentlyPlaying].classList.remove('playing')
    updatePlayButton(currentlyPlaying, false)
    var pp = document.getElementById('prog-' + currentlyPlaying)
    if (pp) pp.style.width = '0%'
  }

  trackEls[idx].classList.add('playing')
  currentlyPlaying = idx
  updatePlayButton(idx, true)
  showMiniPlayer(idx)

  var audio = getAudioObj(idx)
  if (audio) {
    audio.play().catch(function () {})
  } else {
    simulateAudioPlayback(idx)
  }
}

function updatePlayButton(idx, playing) {
  var trackEls = document.querySelectorAll('.track')
  if (!trackEls[idx]) return
  var icon = trackEls[idx].querySelector('.t-pi')
  if (!icon) return
  icon.innerHTML = playing
    ? '<rect x="3" y="2" width="2" height="8"/><rect x="7" y="2" width="2" height="8"/>'
    : '<path d="M3 2 L3 10 L9 6 Z" fill="currentColor"/>'
  setMiniPlayerIcon(playing)
}

function simulateAudioPlayback(idx) {
  var t = ACTIVE_TRACKS[idx]
  var duration = t ? (t.duration || 0) : 0
  var elapsed  = 0
  clearInterval(progressInterval)
  if (!duration) return
  progressInterval = setInterval(function () {
    if (currentlyPlaying !== idx) { clearInterval(progressInterval); return }
    elapsed++
    var p = document.getElementById('prog-' + idx)
    var d = document.getElementById('duration-' + idx)
    var pct = (elapsed / duration) * 100
    if (p) p.style.width = pct + '%'
    if (d) d.textContent = formatTime(elapsed) + ' / ' + formatTime(duration)
    setMiniPlayerFill(pct)
    setMiniPlayerTime(elapsed, duration)
    if (elapsed >= duration) {
      clearInterval(progressInterval)
      var trackEls = document.querySelectorAll('.track')
      if (trackEls[idx]) trackEls[idx].classList.remove('playing')
      updatePlayButton(idx, false)
      if (p) p.style.width = '0%'
      currentlyPlaying = -1
      hideMiniPlayer()
    }
  }, 1000)
}

// ==================== BLOG ARTICLES (FRAGMENTS) ====================

var ARTICLES_FALLBACK = [
  {
    n:'01', ti:'On Silence as Material', tg:'Sound Theory', dt:'Dec 2024',
    body:`<p>Silence is not absence. It's the canvas on which sound becomes visible.</p>
<p>When Cage sat in the anechoic chamber, he didn't find silence. He found his nervous system: the high whine of consciousness, the low rumble of blood. <em>The body refuses to be quiet.</em></p>
<h3>The Paradox</h3>
<p>We call it "silence" when we mean "the sounds we've learned to ignore." The hum of refrigerators. The distant traffic.</p>
<p>In my work, I don't use silence. I use <strong>controlled emptiness</strong>: space that has been cleared, intentionally.</p>
<div class="af-rule"></div>
<p>This is not minimalism. This is maximum attention to what persists when everything decorative has been stripped away.</p>`
  },
  {
    n:'02', ti:'The Uncanny Valley of Branding', tg:'Business', dt:'Nov 2024',
    body:`<p>Most brands today exist in aesthetic purgatory. They're not quite human, not quite machine. Just human enough to feel fake.</p>
<p>The tell: when companies write like they're reading a script about "authenticity." <em>The harder they try, the more automated they sound.</em></p>
<h3>Why This Happens</h3>
<p>Because most brand language is built backwards. They start with what they want to project, then work backward.</p>
<p><strong>Real voice</strong> doesn't work like that. It emerges when you're solving a specific problem for a specific person.</p>
<div class="af-rule"></div>
<p>Stop asking "what do we want to sound like?" Start asking "what do we actually think?"</p>`
  },
  {
    n:'03', ti:'Fashion as Armor', tg:'Fashion', dt:'Oct 2024',
    body:`<p>We talk about self-expression. But what we wear is mostly protection.</p>
<p>From weather. From judgment. From being seen too clearly. <em>Clothing is a controlled reveal.</em></p>
<h3>The Uniform</h3>
<p>Everyone has one. The outfit they default to when they don't want to think. It's about <strong>cognitive efficiency</strong>.</p>
<div class="af-rule"></div>
<p>The best style is whatever lets you forget about it entirely and focus on the work.</p>`
  },
  {
    n:'04', ti:'Against Creativity', tg:'Philosophy', dt:'Sep 2024',
    body:`<p>"Creativity" is a trap. It makes art sound optional. A personality trait.</p>
<p>Art is not self-expression. It's <em>necessity made visible.</em></p>
<h3>The Real Question</h3>
<p>Not "am I creative?" But: "what problem am I solving?" Every piece of art solves a problem.</p>
<p><strong>Good art</strong> is when the artist's problem and the world's problem align.</p>`
  },
  {
    n:'05', ti:'The Attention Economy Is a Lie', tg:'Culture', dt:'Aug 2024',
    body:`<p>We don't have an attention deficit. We have a <strong>meaning surplus</strong>.</p>
<p>The crisis isn't that people can't focus. It's that focusing on most things is actively punished with boredom.</p>
<h3>What Actually Works</h3>
<p>Make things that justify the attention they demand. <em>Not because they're addictive. Because they're nourishing.</em></p>
<div class="af-rule"></div>
<p>The attention economy isn't about capturing attention. It's about deserving it.</p>`
  },
  {
    n:'06', ti:'Process Over Product', tg:'Psychology', dt:'Jul 2024',
    body:`<p>Everyone wants the finished thing. No one wants to do the work. This is the entire economy.</p>
<p><em>The work is the point.</em> The product is just evidence that work happened.</p>
<h3>The Paradox</h3>
<p>When you focus on process, you get both quality work and a better product as a side effect.</p>
<p><strong>The goal is to build a process you never want to leave.</strong></p>`
  },
  {
    n:'07', ti:'Taste Is Memory', tg:'Culture', dt:'Jun 2024',
    body:`<p>Taste is actually <em>compression of past experience.</em> Every judgment contains every aesthetic decision you've ever made.</p>
<h3>How It Forms</h3>
<p>Slowly. Through repeated exposure to quality. Not quality as measured by others.</p>
<p>Good taste means you've seen enough to recognize what works <strong>for you</strong>, regardless of trends.</p>`
  },
  {
    n:'08', ti:'The Death of Mystery', tg:'Philosophy', dt:'May 2024',
    body:`<p>Everything is explained now. Every band has an origin story. Every artist has a process video.</p>
<p>We traded mystery for <em>access</em>. And in the process, we killed what made art magnetic.</p>
<h3>What We Lost</h3>
<p>The space to project. To imagine. To fill in blanks with our own meaning.</p>
<p><strong>The best work still refuses to explain itself.</strong></p>
<div class="af-rule"></div>
<p>Mystery isn't withholding. It's respecting the work enough to let it speak for itself.</p>`
  }
]

var currentArticle  = 0
var ACTIVE_ARTICLES = ARTICLES_FALLBACK

function buildArticles() {
  var list = document.getElementById('art-list')
  if (!list) return
  list.innerHTML = ''

  ACTIVE_ARTICLES = (SANITY_CONTENT && SANITY_CONTENT.posts && SANITY_CONTENT.posts.length)
    ? SANITY_CONTENT.posts.map(function (p, i) {
        return {
          n:       pad2(i + 1),
          ti:      p.title,
          tg:      p.tag || '',
          dt:      fmtDate(p.publishedAt),
          body:    portableTextToHtml(p.body) || ('<p>' + (p.excerpt || '') + '</p>'),
          imgUrl:  p.imageUrl || ''
        }
      })
    : ARTICLES_FALLBACK

  ACTIVE_ARTICLES.forEach(function (a, i) {
    var row = document.createElement('div')
    row.className = 'art-row'
    row.dataset.index = i
    row.onclick = function () { openArticle(parseInt(this.dataset.index)) }
    row.innerHTML =
      '<div class="a-n">'  + a.n  + '</div>' +
      '<div class="a-ti">' + a.ti + '</div>' +
      '<div class="a-tg">' + a.tg + '</div>' +
      '<div class="a-dt">' + a.dt + '</div>'
    row.addEventListener('mouseenter', function () { if (typeof ch === 'function') ch(true)  })
    row.addEventListener('mouseleave', function () { if (typeof ch === 'function') ch(false) })
    list.appendChild(row)
  })
}

function openArticle(idx) {
  currentArticle = idx
  var a = ACTIVE_ARTICLES[idx]
  var cover = document.getElementById('af-cover')
  if (cover) {
    if (a.imgUrl) {
      cover.innerHTML = '<img src="' + esc(a.imgUrl) + '" alt="' + esc(a.ti) + '">'
      cover.style.display = ''
    } else {
      cover.innerHTML = ''
      cover.style.display = 'none'
    }
  }
  document.getElementById('af-meta').textContent  = (a.tg || '').toUpperCase() + ' · ' + (a.dt || '').toUpperCase()
  document.getElementById('af-title').textContent = a.ti
  document.getElementById('af-body').innerHTML    = a.body
  var nextIdx = (idx + 1) % ACTIVE_ARTICLES.length
  document.getElementById('af-next-title').textContent = ACTIVE_ARTICLES[nextIdx].ti
  var el = document.getElementById('art-full')
  el.classList.add('open')
  el.scrollTop = 0
}

function closeArticle() {
  document.getElementById('art-full').classList.remove('open')
}

function nextArticle() {
  currentArticle = (currentArticle + 1) % ACTIVE_ARTICLES.length
  openArticle(currentArticle)
}

// ==================== TOTEMS + REQUEST MODAL ====================

var PRODUCTS_FALLBACK = [
  { name:'Obsidian Mirror',    price:'On Request', det:'Volcanic glass · Scrying tool',       desc:'Hand-polished obsidian mirror for contemplation and shadow work. Each piece unique, approx. 15 cm diameter, mounted on consecrated wood base.',   ai:10 },
  { name:'Sigil Pendant',      price:'On Request', det:'Sterling silver · Talisman',          desc:'Hand-forged pendant inscribed with protective glyphs. Charged under specific lunar phases. Includes authentication and ritual instructions.',        ai:13 },
  { name:'Sound Bowl Set',     price:'On Request', det:'Bronze · Harmonic resonance',         desc:'Three precision-tuned singing bowls creating perfect intervals. For sound meditation and energy work. Includes striker and cushion.',                ai:9  },
  { name:'Incense Collection', price:'On Request', det:'Wildcrafted · Seven scents',          desc:'Hand-rolled incense set: Protection, Clarity, Dreams, Grounding, Vision, Transformation, Invocation. Traditional methods, natural resins.',          ai:14 },
  { name:'Wax Seal Kit',       price:'On Request', det:'Bespoke design · Seven colors',       desc:'Custom sigil design through consultation. Brass stamp, seven wax colors, melting spoon, and ceremonial instructions included.',                      ai:11 },
  { name:'Tarot Cloth',        price:'On Request', det:'Hand-dyed silk · Sacred geometry',   desc:'Luxury 90×90 cm silk cloth with hand-painted geometry patterns. Midnight blue or deep crimson. Consecrated before shipping.',                        ai:15 },
  { name:'Crystal Grid Set',   price:'On Request', det:'Quartz · Geometric arrangement',     desc:'Seven crystal points arranged in sacred geometry pattern. Includes instruction manual for activation and intention setting.',                          ai:12 },
  { name:'Ritual Blade',       price:'On Request', det:'Forged steel · Ceremonial',          desc:'Hand-forged athame for ritual work. Never sharpened, symbolic only. Includes wooden sheath and cleansing instructions.',                              ai:16 }
]

var currentProduct  = null
var ACTIVE_PRODUCTS = PRODUCTS_FALLBACK

function buildShop() {
  var grid = document.getElementById('sgrid')
  if (!grid) return
  grid.innerHTML = ''

  ACTIVE_PRODUCTS = (SANITY_CONTENT && SANITY_CONTENT.totems && SANITY_CONTENT.totems.length)
    ? SANITY_CONTENT.totems.map(function (t) {
        var materials = Array.isArray(t.materials) ? t.materials.join(' · ') : ''
        return {
          name:     t.title,
          price:    t.pricing || 'On Request',
          det:      materials || t.category || '',
          desc:     t.fullDescription || t.shortDescription || '',
          imageUrl: t.imageUrl || '',
          imageAlt: t.imageAlt || t.title
        }
      })
    : PRODUCTS_FALLBACK

  ACTIVE_PRODUCTS.forEach(function (p, i) {
    var prod = document.createElement('div')
    prod.className = 'product'
    prod.dataset.index = i

    var visHtml = p.imageUrl
      ? '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.imageAlt || p.name) + '" style="width:100%;height:auto;display:block;">'
      : (typeof mkArt === 'function' ? mkArt(p.ai || 10, 300, 300) : '')

    prod.innerHTML =
      '<div class="prod-vis">' + visHtml + '</div>' +
      '<div class="prod-info">' +
        '<div class="prod-name">' + esc(p.name) + '</div>' +
        '<div class="prod-det">'  + esc(p.det)  + '</div>' +
        '<div class="prod-row">' +
          '<div class="prod-price">' + esc(p.price) + '</div>' +
          '<button class="prod-add" onclick="event.stopPropagation();openRequestModal(' + i + ')">Make a Request</button>' +
        '</div>' +
      '</div>'

    prod.addEventListener('click', function () { openRequestModal(parseInt(this.dataset.index)) })
    prod.addEventListener('mouseenter', function () { if (typeof ch === 'function') ch(true)  })
    prod.addEventListener('mouseleave', function () { if (typeof ch === 'function') ch(false) })
    grid.appendChild(prod)
  })
}

// ---- Request modal ----

function openRequestModal(idx) {
  currentProduct = ACTIVE_PRODUCTS[idx]

  var modal = document.getElementById('request-modal')
  if (!modal) { createRequestModal(); modal = document.getElementById('request-modal') }

  var titleEl = document.getElementById('req-title')
  var descEl  = document.getElementById('req-desc')

  titleEl.textContent = currentProduct.name
  descEl.textContent  = currentProduct.desc

  document.getElementById('req-form').reset()
  document.getElementById('req-t').value = Date.now()
  document.getElementById('req-success').style.display = 'none'
  document.getElementById('req-error').style.display   = 'none'
  modal.classList.add('show')
}

function closeRequestModal() {
  var modal = document.getElementById('request-modal')
  if (modal) modal.classList.remove('show')
}

function createRequestModal() {
  var modal = document.createElement('div')
  modal.id        = 'request-modal'
  modal.className = 'request-modal'
  modal.innerHTML = `
    <div class="request-content">
      <div class="request-header">
        <h2 style="font-family:'Syne',sans-serif;font-weight:700;font-size:1.1rem;color:var(--ink);margin:0;letter-spacing:.02em;">Make a Request</h2>
        <button class="request-close" onclick="closeRequestModal()" aria-label="Close">×</button>
      </div>
      <div class="request-body">
        <h3 class="request-title" id="req-title"></h3>
        <p class="request-subtitle" id="req-desc"></p>

        <form class="request-form" id="req-form" onsubmit="submitRequest(event)">
          <input type="text" name="website" style="display:none;position:absolute;left:-9999px;" tabindex="-1" autocomplete="off">
          <input type="hidden" name="_t" id="req-t">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">First Name <span style="color:var(--accent)">*</span></label>
              <input type="text" class="form-input" name="firstName" required placeholder="">
            </div>
            <div class="form-group">
              <label class="form-label">Last Name <span style="color:var(--accent)">*</span></label>
              <input type="text" class="form-input" name="lastName" required placeholder="">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Email Address <span style="color:var(--accent)">*</span></label>
            <input type="email" class="form-input" name="email" required placeholder="">
          </div>

          <div class="form-group">
            <label class="form-label">Your Message <span style="opacity:.5;font-weight:400;">(optional)</span></label>
            <textarea class="form-textarea" name="message" placeholder="Tell me more about your interest, how you found this piece, or any questions you have…"></textarea>
          </div>

          <button type="submit" class="form-submit">Submit Request</button>

          <div class="form-success" id="req-success" style="display:none;">
            <p><strong>Thank you.</strong> Your request has been received. I'll be in touch soon.</p>
          </div>
          <div class="form-error" id="req-error" style="display:none;">
            <p>Something went wrong. Please try again or email directly.</p>
          </div>
        </form>
      </div>
    </div>`

  modal.addEventListener('click', function (e) { if (e.target === modal) closeRequestModal() })
  document.body.appendChild(modal)
}

async function submitRequest(e) {
  e.preventDefault()
  var form = e.target
  var btn  = form.querySelector('[type="submit"]')

  var data = {
    item:      currentProduct ? currentProduct.name : '',
    firstName: form.firstName.value,
    lastName:  form.lastName.value,
    email:     form.email.value,
    message:   form.message ? form.message.value : '',
    website:   form.website ? form.website.value : '',
    _t:        form._t ? form._t.value : ''
  }

  btn.textContent = 'Sending…'
  btn.disabled    = true

  try {
    var res = await fetch('/api/submit-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    })
    if (res.ok) {
      document.getElementById('req-success').style.display = 'block'
      form.reset()
      setTimeout(closeRequestModal, 3000)
    } else {
      throw new Error('Server error')
    }
  } catch (err) {
    console.error('Request error:', err)
    document.getElementById('req-error').style.display = 'block'
    btn.textContent = 'Submit Request'
    btn.disabled    = false
  }
}

// ==================== CONTACT FORM ====================

function initContactForm() {
  var page = document.getElementById('pg-contact')
  if (!page) return

  var btn = page.querySelector('.ct-send')
  if (!btn) return

  var _contactT = Date.now()

  btn.addEventListener('click', async function (e) {
    e.preventDefault()

    var nameInput    = page.querySelector('input[type="text"]')
    var emailInput   = page.querySelector('input[type="email"]')
    var subjectSel   = page.querySelector('select')
    var messageArea  = page.querySelector('textarea')

    var name    = nameInput   ? nameInput.value.trim()   : ''
    var email   = emailInput  ? emailInput.value.trim()  : ''
    var subject = subjectSel  ? subjectSel.value         : ''
    var message = messageArea ? messageArea.value.trim() : ''

    if (!name || !email || !message) {
      btn.textContent = 'Fill in all fields ↑'
      setTimeout(function () { btn.innerHTML = 'Send &rarr;' }, 2500)
      return
    }

    var origText = btn.innerHTML
    btn.textContent = 'Sending…'
    btn.disabled    = true

    try {
      var res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, subject, message, website: '', _t: _contactT })
      })
      if (!res.ok) throw new Error('Server error')
      btn.textContent = 'Sent ✓'
      if (nameInput)   nameInput.value   = ''
      if (emailInput)  emailInput.value  = ''
      if (subjectSel)  subjectSel.value  = ''
      if (messageArea) messageArea.value = ''
      setTimeout(function () { btn.innerHTML = origText; btn.disabled = false }, 4000)
    } catch (err) {
      console.error('Contact error:', err)
      btn.textContent = 'Error. Try again.'
      btn.disabled    = false
      setTimeout(function () { btn.innerHTML = origText }, 3000)
    }
  })
}

// ==================== MODAL STYLES (injected once) ====================

function injectModalStyles() {
  if (document.getElementById('req-modal-styles')) return
  var style = document.createElement('style')
  style.id = 'req-modal-styles'
  style.textContent = `
    .request-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:800;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s;}
    .request-modal.show{opacity:1;pointer-events:all;}
    .request-content{background:var(--bg);width:min(560px,92vw);max-height:90vh;overflow-y:auto;padding:0;}
    .request-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid var(--rule-s);}
    .request-close{background:none;border:none;font-size:22px;color:var(--mid);cursor:pointer;padding:0;line-height:1;}
    .request-close:hover{color:var(--ink);}
    .request-body{padding:24px;}
    .request-title{font-family:'Syne',sans-serif;font-weight:700;font-size:1.05rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink);margin:0 0 8px;}
    .request-subtitle{font-family:'Syne',sans-serif;font-size:.78rem;line-height:1.65;color:var(--mid);margin:0 0 24px;}
    .request-form{display:flex;flex-direction:column;gap:14px;}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    @media(max-width:480px){.form-row{grid-template-columns:1fr;}}
    .form-group{display:flex;flex-direction:column;gap:6px;}
    .form-label{font-family:'Space Mono',monospace;font-size:7px;letter-spacing:.18em;text-transform:uppercase;color:var(--soft);}
    .form-input,.form-textarea{background:var(--bg2);border:1px solid var(--rule-s);color:var(--ink);font-family:'Syne',sans-serif;font-size:.82rem;padding:10px 12px;outline:none;transition:border-color .2s;}
    .form-input:focus,.form-textarea:focus{border-color:var(--ink);}
    .form-textarea{resize:vertical;min-height:90px;}
    .form-submit{font-family:'Syne',sans-serif;font-weight:700;font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--bg);background:var(--ink);border:none;cursor:pointer;padding:14px 28px;transition:opacity .2s;}
    .form-submit:hover{opacity:.75;}
    .form-submit:disabled{opacity:.5;cursor:not-allowed;}
    .form-success,.form-error{padding:12px 16px;font-family:'Syne',sans-serif;font-size:.82rem;line-height:1.5;}
    .form-success{background:rgba(100,180,100,.12);color:var(--ink);}
    .form-error{background:rgba(200,60,60,.12);color:var(--ink);}
    #mini-player{position:fixed;bottom:0;left:0;right:0;height:56px;background:var(--ink);color:var(--bg);display:flex;align-items:center;gap:16px;padding:0 20px;z-index:700;transform:translateY(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);}
    body.night #mini-player{background:#f5f3ee;color:#0c0b09;}
    #mini-player.mp-visible{transform:translateY(0);}
    .mp-info{display:flex;align-items:baseline;gap:10px;min-width:0;flex:0 0 auto;max-width:220px;}
    .mp-num{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.14em;opacity:.5;flex-shrink:0;}
    .mp-title{font-family:'Syne',sans-serif;font-weight:700;font-size:.78rem;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .mp-genre{font-family:'Space Mono',monospace;font-size:7px;letter-spacing:.1em;text-transform:uppercase;opacity:.4;flex-shrink:0;display:none;}
    @media(min-width:600px){.mp-genre{display:block;}}
    .mp-prog-wrap{flex:1;height:1px;background:rgba(255,255,255,.18);position:relative;cursor:pointer;}
    body.night .mp-prog-wrap{background:rgba(0,0,0,.15);}
    .mp-prog-fill{position:absolute;left:0;top:0;height:100%;background:rgba(255,255,255,.7);width:0%;transition:width .8s linear;}
    body.night .mp-prog-fill{background:rgba(12,11,9,.6);}
    .mp-time{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.06em;opacity:.5;flex-shrink:0;min-width:72px;text-align:right;}
    .mp-btn{background:none;border:1px solid rgba(255,255,255,.25);color:var(--bg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:opacity .2s;padding:0;}
    body.night .mp-btn{border-color:rgba(12,11,9,.2);color:#0c0b09;}
    .mp-btn:hover{opacity:.65;}
    .mp-btn svg{pointer-events:none;}
    .mp-go{font-family:'Space Mono',monospace;font-size:7px;letter-spacing:.12em;text-transform:uppercase;opacity:.35;cursor:pointer;background:none;border:none;color:var(--bg);padding:0;flex-shrink:0;transition:opacity .2s;}
    body.night .mp-go{color:#0c0b09;}
    .mp-go:hover{opacity:.7;}
  `
  document.head.appendChild(style)
}

// ==================== PERSISTENT MINI PLAYER ====================

function injectMiniPlayer() {
  if (document.getElementById('mini-player')) return
  var bar = document.createElement('div')
  bar.id = 'mini-player'
  bar.innerHTML =
    '<div class="mp-info">' +
      '<span class="mp-num" id="mp-num">01</span>' +
      '<span class="mp-title" id="mp-title"></span>' +
      '<span class="mp-genre" id="mp-genre"></span>' +
    '</div>' +
    '<div class="mp-prog-wrap" id="mp-prog-wrap">' +
      '<div class="mp-prog-fill" id="mp-prog-fill"></div>' +
    '</div>' +
    '<span class="mp-time" id="mp-time">0:00 / --:--</span>' +
    '<button class="mp-btn" id="mp-play-btn" onclick="mpToggle()" title="Play / Pause">' +
      '<svg id="mp-icon" width="12" height="12" viewBox="0 0 12 12">' +
        '<rect x="3" y="2" width="2" height="8" fill="currentColor"/>' +
        '<rect x="7" y="2" width="2" height="8" fill="currentColor"/>' +
      '</svg>' +
    '</button>' +
    '<button class="mp-btn" onclick="mpStop()" title="Stop">&#x2715;</button>' +
    '<button class="mp-go" onclick="go(\'play\')" title="Go to Playground">Playground &rarr;</button>'
  document.body.appendChild(bar)

  document.getElementById('mp-prog-wrap').addEventListener('click', function (e) {
    if (currentlyPlaying < 0) return
    var rect = this.getBoundingClientRect()
    var pct  = (e.clientX - rect.left) / rect.width
    var audio = audioObjects[currentlyPlaying]
    if (audio && audio.duration) {
      audio.currentTime = pct * audio.duration
    }
  })
}

function showMiniPlayer(idx) {
  var t = ACTIVE_TRACKS[idx]
  if (!t) return
  var el = document.getElementById('mini-player')
  if (!el) return
  var numEl   = document.getElementById('mp-num')
  var titleEl = document.getElementById('mp-title')
  var genreEl = document.getElementById('mp-genre')
  if (numEl)   numEl.textContent   = t.n  || ''
  if (titleEl) titleEl.textContent = t.ti || ''
  if (genreEl) genreEl.textContent = t.ge || ''
  setMiniPlayerFill(0)
  el.classList.add('mp-visible')
  setMiniPlayerIcon(true)
}

function hideMiniPlayer() {
  var el = document.getElementById('mini-player')
  if (el) el.classList.remove('mp-visible')
}

function setMiniPlayerIcon(playing) {
  var icon = document.getElementById('mp-icon')
  if (!icon) return
  icon.innerHTML = playing
    ? '<rect x="3" y="2" width="2" height="8" fill="currentColor"/><rect x="7" y="2" width="2" height="8" fill="currentColor"/>'
    : '<path d="M3 2 L3 10 L9 6 Z" fill="currentColor"/>'
}

function setMiniPlayerFill(pct) {
  var fill = document.getElementById('mp-prog-fill')
  if (fill) fill.style.width = pct + '%'
}

function setMiniPlayerTime(current, duration) {
  var el = document.getElementById('mp-time')
  if (el) el.textContent = formatTime(current) + ' / ' + formatTime(duration)
}

function mpToggle() {
  if (currentlyPlaying >= 0) togglePlay(currentlyPlaying)
}

function mpStop() {
  if (currentlyPlaying >= 0) {
    var audio = audioObjects[currentlyPlaying]
    if (audio) { audio.pause(); audio.currentTime = 0 }
    else clearInterval(progressInterval)
    var trackEls = document.querySelectorAll('.track')
    if (trackEls[currentlyPlaying]) trackEls[currentlyPlaying].classList.remove('playing')
    updatePlayButton(currentlyPlaying, false)
    var p = document.getElementById('prog-' + currentlyPlaying)
    if (p) p.style.width = '0%'
    currentlyPlaying = -1
  }
  hideMiniPlayer()
}

// ==================== LEGAL PAGES ====================

var LEGAL_PAGES = {

  terms: {
    title: 'Terms & Conditions',
    content: `
      <h1 class="legal-h1">Terms &amp; Conditions</h1>
      <p class="legal-sub">Last updated — May 2026</p>

      <div class="legal-section">
        <h3>01 — General</h3>
        <p>These Terms and Conditions govern your use of the SYLHERA website and any purchase, commission, or service agreement made through it. By accessing or using this site, you accept these terms in full. If you disagree with any part, please do not use this site.</p>
        <p>SYLHERA reserves the right to modify these terms at any time. Changes take effect immediately upon publication. Continued use of the site constitutes acceptance of the revised terms.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>02 — Limited Editions &amp; Totems</h3>
        <p>All objects sold through this site are <strong>limited-edition, handcrafted pieces</strong>. Each piece is unique or produced in a strictly limited run. Photographs are representative but minor variations in material, patina, and dimension are inherent to the handmade process and are not considered defects.</p>
        <p>Availability is indicated at the time of listing. SYLHERA reserves the right to withdraw any item from sale at any time prior to order confirmation.</p>
        <p>Pricing is listed in Euros (€) and is exclusive of applicable customs duties or import taxes, which remain the sole responsibility of the buyer.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>03 — Orders &amp; Payment</h3>
        <p>All orders are processed individually. Upon submitting a request, you will receive a confirmation and invoice by email within 48 hours. Your order is only confirmed once payment has been received in full.</p>
        <p>Payment is accepted by bank transfer or agreed secure method communicated at time of invoice. SYLHERA does not store payment information.</p>
        <p>For high-value or bespoke pieces, a <strong>50% deposit</strong> may be required before work begins, with the balance due prior to shipping.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>04 — Shipping &amp; Delivery</h3>
        <p>Objects are shipped from Paris, France. Delivery timelines vary by destination and are provided at the time of order confirmation. All pieces are carefully packaged and shipped with tracking and insurance.</p>
        <p>SYLHERA is not responsible for delays caused by customs clearance, carrier issues, or circumstances beyond our control. Risk of loss passes to the buyer upon handover to the carrier.</p>
        <p>International buyers are responsible for all applicable import duties, taxes, and customs fees levied by their country of import.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>05 — Final Sale Policy</h3>
        <p><strong>All sales are final.</strong> Due to the limited, handcrafted, and often one-of-a-kind nature of the pieces, returns and exchanges are not accepted. Please review all information carefully before submitting a request.</p>
        <p>In the event of damage during transit, the buyer must document and report the damage within 48 hours of receipt, with photographs, so that an insurance claim can be initiated.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>06 — Commissions &amp; Creative Services</h3>
        <p>Custom commissions (music composition, creative direction, writing, bespoke objects) are subject to a separate written agreement established on a per-project basis. All terms including scope, timeline, deliverables, and fees will be confirmed in writing before work begins.</p>
        <p>SYLHERA retains full intellectual property rights over all created work unless explicitly transferred in writing as part of the agreement. A usage licence may be granted in lieu of full transfer.</p>
        <p>Deposits paid on commissions are non-refundable once creative work has commenced.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>07 — Intellectual Property</h3>
        <p>All content on this site — including but not limited to music, sound recordings, visual works, objects, texts, photographs, and graphic elements — is the exclusive intellectual property of SYLHERA and is protected under applicable French and international copyright law.</p>
        <p>No content may be reproduced, distributed, adapted, or used commercially without prior written authorisation. Personal, non-commercial use with proper attribution is permitted.</p>
        <p>Purchasing a physical object does not transfer any intellectual property rights in the associated work, design, or identity.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>08 — Privacy</h3>
        <p>Personal data collected through this site (name, email, message content) is used solely for the purpose of responding to your enquiry or processing your order. It is never sold or shared with third parties for commercial purposes.</p>
        <p>You have the right to access, correct, or request deletion of your personal data at any time by writing to the contact address provided on this site.</p>
        <p>For full details, refer to our <strong>Legal Notice</strong>.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>09 — Governing Law</h3>
        <p>These terms are governed by French law. Any dispute arising from the use of this site or from a purchase agreement shall be subject to the exclusive jurisdiction of the competent courts of Paris, France, unless mandatory consumer protection laws in your country provide otherwise.</p>
      </div>
    `
  },

  legal: {
    title: 'Legal Notice',
    content: `
      <h1 class="legal-h1">Legal Notice</h1>
      <p class="legal-sub">Mentions légales — conformément à la loi française</p>

      <div class="legal-section">
        <h3>01 — Website Publisher</h3>
        <p>This website is published by <strong>SYLHERA</strong>, an independent creative practice operating under French law, based in Paris, France.</p>
        <p>For any enquiry: <a href="mailto:contact@sylhera.com" style="color:var(--ink);text-decoration:underline;">contact@sylhera.com</a></p>
        <p><em>In accordance with French Law n°2004-575 of 21 June 2004 (Loi pour la Confiance dans l'Économie Numérique), the full identity of the publisher is available upon written request.</em></p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>02 — Hosting</h3>
        <p>This site is hosted by <strong>Vercel Inc.</strong>, 340 Pine Street, Suite 701, San Francisco, CA 94104, United States. <a href="https://vercel.com" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline;">vercel.com</a></p>
        <p>Content management is handled via <strong>Sanity.io</strong>, Sanity AS, Stortingsgata 8, 0161 Oslo, Norway. <a href="https://sanity.io" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline;">sanity.io</a></p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>03 — Intellectual Property</h3>
        <p>All elements of this site — including the name SYLHERA, all visual works, musical compositions, sound recordings, objects, texts, illustrations, and the overall structure and design of the site — are protected by copyright and are the exclusive property of their author.</p>
        <p>Any reproduction, representation, adaptation, or distribution, in full or in part, by any means whatsoever, without prior written authorisation, is strictly prohibited and constitutes an infringement under Articles L.335-2 et seq. of the French Intellectual Property Code.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>04 — Personal Data &amp; GDPR</h3>
        <p>SYLHERA collects personal data (name, email address, message content) solely through the contact and request forms on this site. This data is processed for the purpose of responding to enquiries and managing orders, on the legal basis of legitimate interest and/or pre-contractual relations.</p>
        <p>Data is retained only for as long as necessary to fulfil the purpose for which it was collected. It is never sold, rented, or shared with third parties for commercial or marketing purposes.</p>
        <p>In accordance with Regulation (EU) 2016/679 (GDPR) and French Law n°78-17 of 6 January 1978 (Loi Informatique et Libertés), you have the right to:</p>
        <p><strong>Access</strong> — obtain a copy of the personal data held about you.<br>
        <strong>Rectification</strong> — correct inaccurate or incomplete data.<br>
        <strong>Erasure</strong> — request deletion of your data ("right to be forgotten").<br>
        <strong>Portability</strong> — receive your data in a structured, machine-readable format.<br>
        <strong>Objection</strong> — object to the processing of your data at any time.</p>
        <p>To exercise these rights, write to: <a href="mailto:contact@sylhera.com" style="color:var(--ink);text-decoration:underline;">contact@sylhera.com</a></p>
        <p>If you believe your rights have not been respected, you may lodge a complaint with the <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés): <a href="https://www.cnil.fr" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline;">cnil.fr</a></p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>05 — Cookies</h3>
        <p>This site does not use advertising or tracking cookies. Technical cookies strictly necessary for the operation of the site (session management, security) may be used without prior consent in accordance with CNIL guidelines.</p>
        <p>No personal browsing data is transmitted to third parties for advertising purposes. Analytics, if any, are anonymised and non-intrusive.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>06 — Limitation of Liability</h3>
        <p>SYLHERA makes every effort to ensure the accuracy and currency of information published on this site but cannot guarantee it is complete or error-free. The site is provided "as is" and SYLHERA accepts no liability for any direct or indirect damages arising from its use.</p>
        <p>SYLHERA is not responsible for the content of third-party sites linked from this site. External links are provided for informational purposes only.</p>
      </div>

      <div class="legal-divider"></div>

      <div class="legal-section">
        <h3>07 — Applicable Law</h3>
        <p>This legal notice is governed by French law. Any dispute arising from the interpretation or execution of these notices shall be subject to the exclusive jurisdiction of the competent courts of Paris, France.</p>
      </div>
    `
  },

  cookies: {
    title: 'Cookies',
    content: `
      <h1 class="legal-h1">Cookie Policy</h1>
      <p class="legal-sub">Last updated — May 2026</p>
      <div class="legal-section">
        <h3>What are cookies?</h3>
        <p>Cookies are small text files stored on your device when you visit a website. They allow the site to remember your preferences and improve your experience.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Cookies we use</h3>
        <p><strong>Strictly necessary:</strong> These ensure the site functions correctly (security, session integrity). They cannot be disabled and do not require your consent.</p>
        <p><strong>No advertising or tracking cookies</strong> are placed by this site. We do not share browsing data with advertising networks or data brokers.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Your choices</h3>
        <p>You can configure your browser to block or delete cookies at any time. Note that blocking strictly necessary cookies may affect site functionality. Refer to your browser's help documentation for instructions.</p>
        <p>For more information on your rights regarding cookies in France, consult the <strong>CNIL</strong>: <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline;">cnil.fr</a></p>
      </div>
    `
  },

  shipping: {
    title: 'Shipping',
    content: `
      <h1 class="legal-h1">Shipping</h1>
      <p class="legal-sub">Worldwide — from Paris, France</p>
      <div class="legal-section">
        <h3>Processing</h3>
        <p>Each object is prepared and packaged individually. Processing time is <strong>3–7 business days</strong> from order confirmation, or as stated in the specific listing. For bespoke pieces, production timelines are communicated separately.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Carriers &amp; Tracking</h3>
        <p>Shipments are sent via insured and tracked carriers (Colissimo International, DHL Express, or equivalent). A tracking number is provided by email upon dispatch.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Customs &amp; Import Duties</h3>
        <p>International orders may be subject to customs clearance procedures and import duties levied by the destination country. These charges are the sole responsibility of the buyer and are not included in the purchase price or shipping fee.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Damaged in Transit</h3>
        <p>If your order arrives damaged, please photograph the packaging and the piece immediately and contact us within <strong>48 hours</strong> of receipt. All shipments are insured; we will initiate a claim on your behalf.</p>
      </div>
    `
  },

  returns: {
    title: 'Returns',
    content: `
      <h1 class="legal-h1">Returns Policy</h1>
      <p class="legal-sub">All sales are final</p>
      <div class="legal-section">
        <h3>Final Sale</h3>
        <p>Due to the <strong>limited-edition, handcrafted, and one-of-a-kind nature</strong> of all pieces offered through this site, all sales are final. Returns, exchanges, and refunds are not accepted unless the piece arrives materially damaged or is demonstrably not as described.</p>
        <p>Please read all descriptions carefully and reach out before purchasing if you have any questions about a piece.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Exception: Transit Damage</h3>
        <p>If a piece is damaged during shipping, document the damage with photographs within <strong>48 hours of receipt</strong> and contact us immediately. We will assess the situation and, where the insurance claim is approved, arrange a replacement or credit at our discretion.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>Commissions</h3>
        <p>Custom commissions are non-refundable once creative work has commenced. In the event of cancellation by the client after work has begun, the deposit is retained to cover work already completed.</p>
      </div>
      <div class="legal-divider"></div>
      <div class="legal-section">
        <h3>EU Consumer Rights</h3>
        <p>Buyers within the European Union should be aware that the standard 14-day withdrawal right under Directive 2011/83/EU <em>does not apply</em> to goods made to the consumer's specifications or clearly personalised, nor to sealed goods which are not suitable for return for health or hygiene protection reasons once unsealed. Most pieces sold through this site fall within these exceptions. If you have a question about a specific piece, please enquire before purchasing.</p>
      </div>
    `
  }
}

function showLegal(key) {
  var page = LEGAL_PAGES[key]
  if (!page) return
  var titleEl   = document.getElementById('lg-title')
  var contentEl = document.getElementById('lg-content')
  if (titleEl)   titleEl.textContent = page.title
  if (contentEl) contentEl.innerHTML = page.content
  var overlay = document.getElementById('pg-legal')
  if (overlay) {
    overlay.classList.add('on')
    var body = overlay.querySelector('.lg-body')
    if (body) body.scrollTop = 0
  }
}

// ==================== INIT ====================

;(function () {
  injectModalStyles()
  injectMiniPlayer()

  document.addEventListener('DOMContentLoaded', async function () {
    // Load Sanity content — falls back gracefully if unconfigured
    await loadSanityContent()

    // Rebuild sections with Sanity data (build functions clear their containers first)
    buildPlay()
    buildArticles()
    buildShop()

    // Apply Sanity overrides for images and settings
    if (SANITY_CONTENT) {
      if (SANITY_CONTENT.siteSettings)
        applySiteSettings(SANITY_CONTENT.siteSettings)
      if (SANITY_CONTENT.homepageImages && SANITY_CONTENT.homepageImages.length)
        applyHomepageImages(SANITY_CONTENT.homepageImages)
      if (SANITY_CONTENT.universeImages && SANITY_CONTENT.universeImages.length)
        applyUniverseImages(SANITY_CONTENT.universeImages)
    }

    initContactForm()
  })
})()
