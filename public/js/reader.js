// Módulo del Visor de Lectura Markdown con soporte Mobile
const Reader = (() => {
  let currentBook = null;
  let currentChapterIndex = 0;
  let fontSizeRem = 1.125;

  // Elementos del DOM
  const readerView = document.getElementById('reader-view');
  const libraryView = document.getElementById('library-view');
  const btnCloseReader = document.getElementById('btn-close-reader');
  const bookTitleEl = document.getElementById('reader-book-title');
  const bookAuthorEl = document.getElementById('reader-book-author');
  const paperBookTitleEl = document.getElementById('reader-book-title-paper');
  const paperBookMetaEl = document.getElementById('reader-book-meta-paper');
  const chapterBadgeEl = document.getElementById('reader-current-badge');
  const chapterTitleEl = document.getElementById('reader-chapter-title');
  const chaptersListEl = document.getElementById('reader-chapters-list');
  const readerContentEl = document.getElementById('reader-content');
  const tocProgressEl = document.getElementById('reader-chapter-progress');
  const btnPrevChapter = document.getElementById('btn-prev-chapter');
  const btnNextChapter = document.getElementById('btn-next-chapter');

  // Elementos de TOC móvil
  const btnToggleToc = document.getElementById('btn-toggle-toc');
  const btnCloseToc = document.getElementById('btn-close-toc');
  const readerToc = document.getElementById('reader-toc');
  const readerTocBackdrop = document.getElementById('reader-toc-backdrop');

  // Configurar Marked.js para usar la clase code-box idéntica en todos los bloques
  if (window.marked) {
    const renderer = new marked.Renderer();
    renderer.code = function (codeText, infoString) {
      const code = typeof codeText === 'object' ? (codeText.text || '') : (codeText || '');
      const lang = typeof codeText === 'object' ? (codeText.lang || '') : ((infoString || '').match(/\S*/)[0] || '');
      let highlighted = code;
      if (window.hljs) {
        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(code, { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(code).value;
        }
      }
      return `<pre class="code-box"><code class="${lang ? 'language-' + lang : ''}">${highlighted}</code></pre>\n`;
    };

    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: true
    });
  }

  function safeMarkdownFragment(markdown, bookId) {
    const parsed = new DOMParser().parseFromString(marked.parse(String(markdown || '')), 'text/html');
    const allowed = new Set([
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI', 'A', 'IMG',
      'PRE', 'CODE', 'BLOCKQUOTE', 'EM', 'STRONG', 'DEL', 'BR', 'HR',
      'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
      'SPAN', 'DIV', 'I', 'B', 'S', 'KBD', 'SUP', 'SUB', 'MARK', 'SMALL'
    ]);
    const fragment = document.createDocumentFragment();
    const safeUrl = (value, image = false) => {
      if (image && /^(?:\.\/)?assets\//i.test(value)) {
        const assetName = value.split('/').pop();
        if (!assetName || /[\\\0]/.test(assetName)) return '';
        return `/api/books/${encodeURIComponent(bookId)}/assets/${encodeURIComponent(assetName)}`;
      }
      try {
        const url = new URL(value, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        if (url.origin === window.location.origin && (value.startsWith('/') || value.startsWith('./'))) return url.pathname + url.search + url.hash;
      } catch (_) {}
      return image ? '' : '#';
    };
    const copy = (node, parent) => {
      if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.nodeValue)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (!allowed.has(node.tagName)) { [...node.childNodes].forEach(child => copy(child, parent)); return; }
      const out = document.createElement(node.tagName.toLowerCase());
      if (node.tagName === 'A') {
        const href = safeUrl(node.getAttribute('href') || '');
        if (href !== '#') out.href = href;
        if (node.getAttribute('target') === '_blank') {
          out.target = '_blank';
          out.rel = 'noopener noreferrer';
        }
      }
      if (node.tagName === 'IMG') {
        const src = safeUrl(node.getAttribute('src') || '', true);
        if (!src) return;
        out.src = src;
        out.alt = node.getAttribute('alt') || '';
        if (node.getAttribute('title')) out.title = node.getAttribute('title');
      }
      if ((node.tagName === 'CODE' || node.tagName === 'PRE' || node.tagName === 'SPAN' || node.tagName === 'DIV') && node.className) {
        out.className = node.className.replace(/[^a-zA-Z0-9 _-]/g, '');
      }
      if (node.tagName === 'TH' || node.tagName === 'TD') {
        const align = node.getAttribute('align');
        if (align && /^(left|center|right|justify)$/i.test(align)) out.setAttribute('align', align);
      }
      [...node.childNodes].forEach(child => copy(child, out));
      parent.appendChild(out);
    };
    [...parsed.body.childNodes].forEach(node => copy(node, fragment));
    return fragment;
  }

  function init() {
    btnCloseReader.addEventListener('click', closeReader);

    // Controles de TOC móvil
    if (btnToggleToc) {
      btnToggleToc.addEventListener('click', toggleToc);
    }
    if (btnCloseToc) {
      btnCloseToc.addEventListener('click', closeToc);
    }
    if (readerTocBackdrop) {
      readerTocBackdrop.addEventListener('click', closeToc);
    }

    btnPrevChapter.addEventListener('click', () => {
      if (currentChapterIndex > 0) {
        goToChapter(currentChapterIndex - 1);
      }
    });

    btnNextChapter.addEventListener('click', () => {
      if (currentBook && currentChapterIndex < currentBook.chapters.length - 1) {
        goToChapter(currentChapterIndex + 1);
      }
    });

    // Control unificado de temas (barra superior y sidebar)
    function applyTheme(theme) {
      const validTheme = ['dark', 'sepia', 'light'].includes(theme) ? theme : 'dark';
      document.body.classList.remove('theme-dark', 'theme-sepia', 'theme-light');
      document.body.classList.add(`theme-${validTheme}`);
      localStorage.setItem('athenaeum-reader-theme', validTheme);
      
      document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === validTheme);
      });
    }

    document.addEventListener('click', (e) => {
      const themeBtn = e.target.closest('[data-theme]');
      if (themeBtn) {
        const theme = themeBtn.getAttribute('data-theme');
        if (theme) applyTheme(theme);
      }
    });

    const savedTheme = localStorage.getItem('athenaeum-reader-theme') || 'dark';
    applyTheme(savedTheme);

    // Control unificado de tamaño de fuente (barra superior y sidebar)
    function updateFontSize(delta) {
      const newSize = Math.min(1.75, Math.max(0.875, Math.round((fontSizeRem + delta) * 1000) / 1000));
      fontSizeRem = newSize;
      document.documentElement.style.setProperty('--reader-font-size', `${fontSizeRem}rem`);
      localStorage.setItem('athenaeum-reader-font-size', fontSizeRem.toString());
      
      const percent = Math.round((fontSizeRem / 1.125) * 100);
      document.querySelectorAll('.reader-font-indicator').forEach(el => {
        el.textContent = `${percent}%`;
      });
    }

    const savedFontSize = parseFloat(localStorage.getItem('athenaeum-reader-font-size'));
    if (!isNaN(savedFontSize) && savedFontSize >= 0.875 && savedFontSize <= 1.75) {
      fontSizeRem = savedFontSize;
      document.documentElement.style.setProperty('--reader-font-size', `${fontSizeRem}rem`);
    }
    const initialPercent = Math.round((fontSizeRem / 1.125) * 100);
    document.querySelectorAll('.reader-font-indicator').forEach(el => {
      el.textContent = `${initialPercent}%`;
    });

    document.querySelectorAll('#font-decrease, .btn-font-dec').forEach(btn => {
      btn.addEventListener('click', () => updateFontSize(-0.125));
    });

    document.querySelectorAll('#font-increase, .btn-font-inc').forEach(btn => {
      btn.addEventListener('click', () => updateFontSize(0.125));
    });

    // Guardado continuo de la posición de scroll en localStorage
    const readerScroll = document.querySelector('.reader-content-scroll');
    if (readerScroll) {
      let scrollTimer = null;
      readerScroll.addEventListener('scroll', () => {
        if (!currentBook || !currentBook.chapters || !currentBook.chapters[currentChapterIndex]) return;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          if (!currentBook || !currentBook.chapters || !currentBook.chapters[currentChapterIndex]) return;
          saveProgress(
            currentBook.id,
            currentChapterIndex,
            currentBook.chapters[currentChapterIndex].id,
            readerScroll.scrollTop
          );
        }, 200);
      }, { passive: true });
    }
  }

  // ==========================================
  // PERSISTENCIA DE LECTURA (LOCALSTORAGE)
  // ==========================================
  const PROGRESS_KEY_PREFIX = 'md_reader_progress_';

  function getProgress(bookId) {
    try {
      const data = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${bookId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveProgress(bookId, chapterIndex, chapterId, scrollTop = 0) {
    if (!bookId) return;
    try {
      localStorage.setItem(`${PROGRESS_KEY_PREFIX}${bookId}`, JSON.stringify({
        bookId,
        chapterIndex,
        chapterId,
        scrollTop: Math.round(scrollTop),
        updatedAt: Date.now()
      }));
    } catch {
      // Ignorar modo incógnito o cuota excedida
    }
  }

  function showResumeNotification(chapterNum) {
    const existing = document.getElementById('reader-resume-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'reader-resume-toast';
    toast.className = 'reader-resume-toast';
    toast.innerHTML = `<span>📖 Reanudando en Capítulo ${chapterNum}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2400);
  }

  function openToc() {
    if (readerToc) readerToc.classList.add('open');
    if (readerTocBackdrop) readerTocBackdrop.classList.remove('hidden');
    if (readerToc) readerToc.setAttribute('aria-hidden', 'false');
    if (btnToggleToc) btnToggleToc.setAttribute('aria-expanded', 'true');
  }

  function closeToc() {
    if (readerToc) readerToc.classList.remove('open');
    if (readerTocBackdrop) readerTocBackdrop.classList.add('hidden');
    if (readerToc) readerToc.setAttribute('aria-hidden', 'true');
    if (btnToggleToc) btnToggleToc.setAttribute('aria-expanded', 'false');
  }

  function toggleToc() {
    if (readerToc && readerToc.classList.contains('open')) {
      closeToc();
    } else {
      openToc();
    }
  }

  async function openBook(bookId, initialChapterId = null) {
    try {
      const res = await fetch(`/api/books/${bookId}`);
      if (!res.ok) throw new Error('No se pudo cargar la información del libro.');
      currentBook = await res.json();

      if (!currentBook.chapters || currentBook.chapters.length === 0) {
        alert('Este libro no contiene capítulos disponibles para lectura.');
        return;
      }

      if (bookTitleEl) bookTitleEl.textContent = currentBook.title;
      if (paperBookTitleEl) paperBookTitleEl.textContent = currentBook.title;
      if (bookAuthorEl) bookAuthorEl.textContent = '';
      if (paperBookMetaEl) paperBookMetaEl.textContent = '';

      renderToc();

      let targetIndex = 0;
      let targetScrollTop = 0;
      let isResumed = false;

      if (initialChapterId !== null && initialChapterId !== undefined) {
        const found = currentBook.chapters.findIndex(c => c.id === Number(initialChapterId));
        if (found !== -1) targetIndex = found;
      } else {
        // Recuperar progreso de lectura desde localStorage
        const saved = getProgress(currentBook.id);
        if (saved) {
          if (saved.chapterId) {
            const found = currentBook.chapters.findIndex(c => c.id === saved.chapterId);
            if (found !== -1) {
              targetIndex = found;
              targetScrollTop = saved.scrollTop || 0;
              isResumed = (targetIndex > 0 || targetScrollTop > 80);
            }
          } else if (saved.chapterIndex != null && currentBook.chapters[saved.chapterIndex]) {
            targetIndex = saved.chapterIndex;
            targetScrollTop = saved.scrollTop || 0;
            isResumed = (targetIndex > 0 || targetScrollTop > 80);
          }
        }
      }

      libraryView.classList.add('hidden');
      readerView.classList.remove('hidden');

      await goToChapter(targetIndex, targetScrollTop);

      // Si se ha reanudado automáticamente un libro empezado, notificar sutilmente
      if (isResumed) {
        showResumeNotification(targetIndex + 1);
      }
    } catch (err) {
      alert('Error al abrir el libro: ' + err.message);
    }
  }

  function renderToc() {
    chaptersListEl.innerHTML = '';
    currentBook.chapters.forEach((ch, idx) => {
      const li = document.createElement('li');
      li.className = `chapter-item ${idx === currentChapterIndex ? 'active' : ''}`;
      li.innerHTML = `
        <span class="chapter-number">${idx + 1}.</span>
        <span class="chapter-item-title"></span>
      `;
      li.querySelector('.chapter-item-title').textContent = ch.title || '';
      li.addEventListener('click', () => {
        goToChapter(idx);
        closeToc(); // Cerrar drawer de capítulos en móvil automáticamente
      });
      chaptersListEl.appendChild(li);
    });
  }

  async function goToChapter(index, restoreScrollTop = null) {
    if (!currentBook || !currentBook.chapters[index]) return;
    currentChapterIndex = index;
    const chapter = currentBook.chapters[index];

    // Guardar progreso inmediatamente en localStorage
    saveProgress(currentBook.id, index, chapter.id, restoreScrollTop !== null ? restoreScrollTop : 0);

    // Actualizar TOC activo
    const items = chaptersListEl.querySelectorAll('.chapter-item');
    items.forEach((item, idx) => {
      const isActive = (idx === index);
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    tocProgressEl.textContent = `Cap. ${index + 1} de ${currentBook.chapters.length}`;
    chapterBadgeEl.textContent = `Capítulo ${index + 1}`;
    chapterTitleEl.textContent = chapter.title;
    readerContentEl.innerHTML = '<p class="loading">Cargando contenido...</p>';

    // Actualizar botones de paginación
    btnPrevChapter.disabled = index === 0;
    btnNextChapter.disabled = index === currentBook.chapters.length - 1;

    try {
      const res = await fetch(`/api/books/${currentBook.id}/chapters/${chapter.id}`);
      if (!res.ok) throw new Error('Error al cargar el contenido del capítulo');
      const data = await res.json();

      readerContentEl.replaceChildren(safeMarkdownFragment(data.content, currentBook.id));

      // Resaltar sintaxis de código
      if (window.hljs) {
        readerContentEl.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      }

      // Scroll al inicio del lector o a la posición guardada
      const readerScroll = document.querySelector('.reader-content-scroll');
      if (readerScroll) {
        if (restoreScrollTop && restoreScrollTop > 0) {
          setTimeout(() => {
            readerScroll.scrollTop = restoreScrollTop;
          }, 80);
        } else {
          readerScroll.scrollTop = 0;
        }
      }
    } catch (err) {
      readerContentEl.innerHTML = `<p class="error-msg">Error al cargar el capítulo: ${err.message}</p>`;
    }
  }

  function closeReader() {
    // Guardar posición actual antes de cerrar
    if (currentBook && currentBook.chapters && currentBook.chapters[currentChapterIndex]) {
      const readerScroll = document.querySelector('.reader-content-scroll');
      const scrollTop = readerScroll ? readerScroll.scrollTop : 0;
      saveProgress(currentBook.id, currentChapterIndex, currentBook.chapters[currentChapterIndex].id, scrollTop);
    }
    closeToc();
    readerView.classList.add('hidden');
    libraryView.classList.remove('hidden');
    currentBook = null;

    // Notificar para refrescar insignias de progreso en la biblioteca
    window.dispatchEvent(new CustomEvent('reader:closed'));
  }

  return {
    init,
    openBook,
    closeReader,
    openToc,
    closeToc,
    getProgress,
    saveProgress
  };
})();
