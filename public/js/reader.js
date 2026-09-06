// Módulo del Visor de Lectura Markdown con soporte Mobile, Marcadores, Progreso y Anotaciones
const Reader = (() => {
  let currentBook = null;
  let currentChapterIndex = 0;
  let fontSizeRem = 1.125;
  let activeHighlightColor = 'yellow';
  let activeSelectionData = null;

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
  const btnReaderBookmark = document.getElementById('btn-reader-bookmark');

  // Elementos de TOC móvil y Drawer
  const btnToggleToc = document.getElementById('btn-toggle-toc');
  const btnCloseToc = document.getElementById('btn-close-toc');
  const readerToc = document.getElementById('reader-toc');
  const readerTocBackdrop = document.getElementById('reader-toc-backdrop');

  // Pestañas y Paneles del Drawer
  const drawerBookmarksList = document.getElementById('reader-bookmarks-list');
  const drawerNotesList = document.getElementById('reader-notes-list');
  const bookmarksEmptyState = document.getElementById('bookmarks-empty-state');
  const notesEmptyState = document.getElementById('notes-empty-state');
  const badgeBookmarksCount = document.getElementById('badge-bookmarks-count');
  const badgeNotesCount = document.getElementById('badge-notes-count');

  // Popover de selección y notas
  const selectionPopover = document.getElementById('reader-selection-popover');
  const popoverNoteInput = document.getElementById('popover-note-input');
  const btnSaveAnnotation = document.getElementById('btn-save-annotation');

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
      if ((node.tagName === 'CODE' || node.tagName === 'PRE' || node.tagName === 'SPAN' || node.tagName === 'DIV' || node.tagName === 'MARK') && node.className) {
        out.className = node.className.replace(/[^a-zA-Z0-9 _-]/g, '');
      }
      if (node.tagName === 'MARK' && node.getAttribute('data-annotation-id')) {
        out.setAttribute('data-annotation-id', node.getAttribute('data-annotation-id'));
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
    if (btnCloseReader) {
      btnCloseReader.addEventListener('click', closeReader);
    }

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

    if (btnPrevChapter) {
      btnPrevChapter.addEventListener('click', () => {
        if (currentChapterIndex > 0) {
          goToChapter(currentChapterIndex - 1);
        }
      });
    }

    if (btnNextChapter) {
      btnNextChapter.addEventListener('click', () => {
        if (currentBook && currentChapterIndex < currentBook.chapters.length - 1) {
          goToChapter(currentChapterIndex + 1);
        }
      });
    }

    // Botón de alternar marcador de capítulo
    if (btnReaderBookmark) {
      btnReaderBookmark.addEventListener('click', handleToggleActiveBookmark);
    }

    // Pestañas del Drawer (TOC, Marcadores, Notas)
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-drawer-tab');
        switchDrawerTab(tab);
      });
    });

    // Control unificado de temas (barra superior y sidebar)
    function applyTheme(theme) {
      const validTheme = ['dark', 'sepia', 'light'].includes(theme) ? theme : 'dark';
      document.body.classList.remove('theme-dark', 'theme-sepia', 'theme-light');
      document.body.classList.add(`theme-${validTheme}`);
      try {
        localStorage.setItem('athenaeum-reader-theme', validTheme);
      } catch (_) {}
      
      document.querySelectorAll('[data-theme]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-theme') === validTheme);
      });
    }

    document.addEventListener('click', (e) => {
      const themeBtn = e.target.closest('[data-theme]');
      if (themeBtn) {
        const theme = themeBtn.getAttribute('data-theme');
        if (theme) applyTheme(theme);
      }
    });

    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('athenaeum-reader-theme') || 'dark';
    } catch (_) {}
    applyTheme(savedTheme);

    // Control unificado de tamaño de fuente (barra superior y sidebar)
    function updateFontSize(delta) {
      const newSize = Math.min(1.75, Math.max(0.875, Math.round((fontSizeRem + delta) * 1000) / 1000));
      fontSizeRem = newSize;
      document.documentElement.style.setProperty('--reader-font-size', `${fontSizeRem}rem`);
      try {
        localStorage.setItem('athenaeum-reader-font-size', fontSizeRem.toString());
      } catch (_) {}
      
      const percent = Math.round((fontSizeRem / 1.125) * 100);
      document.querySelectorAll('.reader-font-indicator').forEach(el => {
        el.textContent = `${percent}%`;
      });
    }

    try {
      const savedFontSize = parseFloat(localStorage.getItem('athenaeum-reader-font-size'));
      if (!isNaN(savedFontSize) && savedFontSize >= 0.875 && savedFontSize <= 1.75) {
        fontSizeRem = savedFontSize;
        document.documentElement.style.setProperty('--reader-font-size', `${fontSizeRem}rem`);
      }
    } catch (_) {}

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

    // Guardado continuo de la posición de scroll con debounce
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

    // Configuración del Popover de selección y resaltado
    initSelectionPopover();
  }

  function initSelectionPopover() {
    if (!selectionPopover) return;

    // Selector de color de resaltado
    selectionPopover.querySelectorAll('.btn-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        activeHighlightColor = swatch.getAttribute('data-color') || 'yellow';
        selectionPopover.querySelectorAll('.btn-color-swatch').forEach(s => {
          s.classList.toggle('active', s === swatch);
        });
      });
    });

    // Guardar anotación desde popover
    if (btnSaveAnnotation) {
      btnSaveAnnotation.addEventListener('click', (e) => {
        e.stopPropagation();
        saveCurrentSelectionAnnotation();
      });
    }

    if (popoverNoteInput) {
      popoverNoteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveCurrentSelectionAnnotation();
        }
      });
    }

    // Capturar evento de fin de selección (mouseup / touchend) en el contenido
    if (readerContentEl) {
      const handleSelectionEnd = () => {
        setTimeout(checkTextSelection, 10);
      };
      readerContentEl.addEventListener('mouseup', handleSelectionEnd);
      readerContentEl.addEventListener('touchend', handleSelectionEnd);

      // Clic en resaltados existentes para eliminarlos o ver notas
      readerContentEl.addEventListener('click', (e) => {
        const highlightEl = e.target.closest('.reader-highlight');
        if (highlightEl && currentBook) {
          const annId = highlightEl.getAttribute('data-annotation-id');
          if (annId) {
            handleHighlightClick(annId, highlightEl);
          }
        }
      });
    }

    // Ocultar popover al hacer clic fuera
    document.addEventListener('mousedown', (e) => {
      if (selectionPopover && !selectionPopover.contains(e.target) && !e.target.closest('#reader-content')) {
        hideSelectionPopover();
      }
    });
  }

  function checkTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !readerContentEl) {
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 1) return;

    if (typeof AnnotationsEngine === 'undefined') return;

    const selector = AnnotationsEngine.serializeSelection(readerContentEl, selection);
    if (!selector) return;

    activeSelectionData = {
      text,
      selector
    };

    // Posicionar popover flotante
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (selectionPopover) {
      const popoverWidth = 260;
      let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
      left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

      let top = rect.top - 70;
      if (top < 60) {
        top = rect.bottom + 10;
      }

      selectionPopover.style.left = `${left}px`;
      selectionPopover.style.top = `${top}px`;
      selectionPopover.classList.remove('hidden');

      if (popoverNoteInput) {
        popoverNoteInput.value = '';
      }
    }
  }

  function hideSelectionPopover() {
    if (selectionPopover) {
      selectionPopover.classList.add('hidden');
    }
    activeSelectionData = null;
  }

  function saveCurrentSelectionAnnotation() {
    if (!activeSelectionData || !currentBook || !currentBook.chapters[currentChapterIndex]) {
      hideSelectionPopover();
      return;
    }

    const chapter = currentBook.chapters[currentChapterIndex];
    const note = popoverNoteInput ? popoverNoteInput.value.trim() : '';

    const annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterId: chapter.id,
      text: activeSelectionData.text,
      note,
      color: activeHighlightColor,
      selector: activeSelectionData.selector,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (typeof StorageAdapter !== 'undefined') {
      StorageAdapter.saveAnnotation(currentBook.id, annotation);
    }

    if (typeof AnnotationsEngine !== 'undefined') {
      AnnotationsEngine.applyHighlight(readerContentEl, annotation);
    }

    // Limpiar selección del usuario
    window.getSelection()?.removeAllRanges();
    hideSelectionPopover();

    // Actualizar lista y contador de notas en el drawer
    renderNotesDrawer();
  }

  function handleHighlightClick(annotationId, highlightEl) {
    if (!currentBook) return;
    const annotations = typeof StorageAdapter !== 'undefined' ? StorageAdapter.getAnnotations(currentBook.id) : [];
    const found = annotations.find(a => a.id === annotationId);
    if (!found) return;

    const noteText = found.note ? `\nNota: "${found.note}"` : '';
    const shouldDelete = confirm(`Resaltado: "${found.text}"${noteText}\n\n¿Deseas eliminar este resaltado?`);
    if (shouldDelete) {
      if (typeof StorageAdapter !== 'undefined') {
        StorageAdapter.removeAnnotation(currentBook.id, annotationId);
      }
      if (typeof AnnotationsEngine !== 'undefined') {
        AnnotationsEngine.removeHighlight(readerContentEl, annotationId);
      }
      renderNotesDrawer();
    }
  }

  // ==========================================
  // PERSISTENCIA DE LECTURA (STORAGEADAPTER)
  // ==========================================

  function getProgress(bookId) {
    if (typeof StorageAdapter !== 'undefined') {
      return StorageAdapter.getProgress(bookId);
    }
    try {
      const data = localStorage.getItem(`athenaeum:progress:${bookId}`) || localStorage.getItem(`md_reader_progress_${bookId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveProgress(bookId, chapterIndex, chapterId, scrollTop = 0) {
    if (!bookId && bookId !== 0) return;
    if (typeof StorageAdapter !== 'undefined') {
      StorageAdapter.saveProgress(bookId, {
        chapterIndex,
        chapterId,
        scrollTop: Math.round(scrollTop),
        updatedAt: Date.now()
      });
      return;
    }
    try {
      localStorage.setItem(`athenaeum:progress:${bookId}`, JSON.stringify({
        bookId,
        chapterIndex,
        chapterId,
        scrollTop: Math.round(scrollTop),
        updatedAt: Date.now()
      }));
    } catch (_) {}
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

  // ==========================================
  // GESTIÓN DE MARCADORES
  // ==========================================

  function handleToggleActiveBookmark() {
    if (!currentBook || !currentBook.chapters[currentChapterIndex]) return;
    const chapter = currentBook.chapters[currentChapterIndex];

    if (typeof BookmarksManager !== 'undefined') {
      const isBookmarked = BookmarksManager.isChapterBookmarked(currentBook.id, chapter.id);
      let label = null;
      if (!isBookmarked) {
        const inputLabel = prompt('Etiqueta para este marcador (opcional):', chapter.title || `Capítulo ${currentChapterIndex + 1}`);
        if (inputLabel === null) return; // Cancelado por usuario
        label = inputLabel.trim() || chapter.title || `Capítulo ${currentChapterIndex + 1}`;
      }

      const res = BookmarksManager.toggleBookmark(currentBook.id, currentChapterIndex, chapter.id, label);
      updateBookmarkToggleState(res.isBookmarked);
      renderBookmarksDrawer();
    }
  }

  function updateBookmarkToggleState(isBookmarked) {
    if (btnReaderBookmark) {
      btnReaderBookmark.classList.toggle('active', Boolean(isBookmarked));
      btnReaderBookmark.setAttribute('title', isBookmarked ? 'Quitar marcador de este capítulo' : 'Marcar este capítulo');
    }
  }

  // ==========================================
  // GESTIÓN DEL DRAWER Y PESTAÑAS
  // ==========================================

  function switchDrawerTab(tabName) {
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-drawer-tab Leach') === tabName || btn.getAttribute('data-drawer-tab') === tabName);
    });

    const panes = {
      toc: document.getElementById('drawer-pane-toc'),
      bookmarks: document.getElementById('drawer-pane-bookmarks'),
      notes: document.getElementById('drawer-pane-notes')
    };

    Object.keys(panes).forEach(k => {
      if (panes[k]) {
        panes[k].classList.toggle('hidden', k !== tabName);
        panes[k].classList.toggle('active', k === tabName);
      }
    });

    if (tabName === 'bookmarks') renderBookmarksDrawer();
    if (tabName === 'notes') renderNotesDrawer();
  }

  function renderBookmarksDrawer() {
    if (!drawerBookmarksList || !currentBook) return;
    drawerBookmarksList.innerHTML = '';

    const bookmarks = typeof BookmarksManager !== 'undefined'
      ? BookmarksManager.getBookmarks(currentBook.id)
      : (typeof StorageAdapter !== 'undefined' ? StorageAdapter.getBookmarks(currentBook.id) : []);

    if (badgeBookmarksCount) {
      badgeBookmarksCount.textContent = bookmarks.length;
      badgeBookmarksCount.classList.toggle('hidden', bookmarks.length === 0);
    }

    if (bookmarks.length === 0) {
      if (bookmarksEmptyState) bookmarksEmptyState.classList.remove('hidden');
      return;
    }
    if (bookmarksEmptyState) bookmarksEmptyState.classList.add('hidden');

    bookmarks.forEach(bm => {
      const li = document.createElement('li');
      li.className = 'drawer-item';
      li.innerHTML = `
        <div class="drawer-item-row">
          <span class="drawer-item-title"></span>
          <button class="btn-item-delete" title="Eliminar marcador" aria-label="Eliminar marcador">✕</button>
        </div>
        <span class="drawer-item-text"></span>
      `;
      li.querySelector('.drawer-item-title').textContent = bm.label || `Capítulo ${bm.chapterIndex + 1}`;
      const chapter = currentBook.chapters[bm.chapterIndex];
      li.querySelector('.drawer-item-text').textContent = chapter ? `Capítulo ${bm.chapterIndex + 1}: ${chapter.title}` : `Capítulo ${bm.chapterIndex + 1}`;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.btn-item-delete')) return;
        goToChapter(bm.chapterIndex);
        closeToc();
      });

      li.querySelector('.btn-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof BookmarksManager !== 'undefined') {
          BookmarksManager.removeBookmark(currentBook.id, bm.id);
        } else if (typeof StorageAdapter !== 'undefined') {
          StorageAdapter.removeBookmark(currentBook.id, bm.id);
        }
        renderBookmarksDrawer();
        if (currentBook.chapters[currentChapterIndex] && currentBook.chapters[currentChapterIndex].id === bm.chapterId) {
          updateBookmarkToggleState(false);
        }
      });

      drawerBookmarksList.appendChild(li);
    });
  }

  function renderNotesDrawer() {
    if (!drawerNotesList || !currentBook) return;
    drawerNotesList.innerHTML = '';

    const annotations = typeof StorageAdapter !== 'undefined' ? StorageAdapter.getAnnotations(currentBook.id) : [];

    if (badgeNotesCount) {
      badgeNotesCount.textContent = annotations.length;
      badgeNotesCount.classList.toggle('hidden', annotations.length === 0);
    }

    if (annotations.length === 0) {
      if (notesEmptyState) notesEmptyState.classList.remove('hidden');
      return;
    }
    if (notesEmptyState) notesEmptyState.classList.add('hidden');

    annotations.forEach(ann => {
      const li = document.createElement('li');
      li.className = 'drawer-item';
      const chapter = currentBook.chapters[ann.chapterIndex];
      const chapterTitle = chapter ? `Capítulo ${ann.chapterIndex + 1}: ${chapter.title}` : `Capítulo ${ann.chapterIndex + 1}`;

      li.innerHTML = `
        <div class="drawer-item-row">
          <span class="drawer-item-title">${chapterTitle}</span>
          <button class="btn-item-delete" title="Eliminar nota" aria-label="Eliminar nota">✕</button>
        </div>
        <span class="drawer-item-text">“${escapeHtml(ann.text)}”</span>
        ${ann.note ? `<span class="drawer-item-note">Nota: ${escapeHtml(ann.note)}</span>` : ''}
      `;

      li.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-item-delete')) return;
        closeToc();
        if (currentChapterIndex !== ann.chapterIndex) {
          await goToChapter(ann.chapterIndex);
        }
        setTimeout(() => {
          const mark = readerContentEl.querySelector(`mark[data-annotation-id="${ann.id}"]`);
          if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mark.classList.remove('highlight-pulse');
            // Trigger reflow for animation restart
            void mark.offsetWidth;
            mark.classList.add('highlight-pulse');
          }
        }, 120);
      });

      li.querySelector('.btn-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof StorageAdapter !== 'undefined') {
          StorageAdapter.removeAnnotation(currentBook.id, ann.id);
        }
        if (typeof AnnotationsEngine !== 'undefined') {
          AnnotationsEngine.removeHighlight(readerContentEl, ann.id);
        }
        renderNotesDrawer();
      });

      drawerNotesList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openToc() {
    if (readerToc) readerToc.classList.add('open');
    if (readerTocBackdrop) readerTocBackdrop.classList.remove('hidden');
    if (readerToc) readerToc.setAttribute('aria-hidden', 'false');
    if (btnToggleToc) btnToggleToc.setAttribute('aria-expanded', 'true');
    renderBookmarksDrawer();
    renderNotesDrawer();
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
      renderBookmarksDrawer();
      renderNotesDrawer();

      let targetIndex = 0;
      let targetScrollTop = 0;
      let isResumed = false;

      if (initialChapterId !== null && initialChapterId !== undefined) {
        const found = currentBook.chapters.findIndex(c => c.id === Number(initialChapterId));
        if (found !== -1) targetIndex = found;
      } else {
        // Recuperar progreso de lectura desde StorageAdapter
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
      li.className = `chapter-item ${idx === currentChapterIndex ? 'active' : ''} ${idx < currentChapterIndex ? 'read' : ''}`;
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

    // Guardar progreso inmediatamente en StorageAdapter
    saveProgress(currentBook.id, index, chapter.id, restoreScrollTop !== null ? restoreScrollTop : 0);

    // Actualizar estado del botón de marcador en la barra superior
    if (typeof BookmarksManager !== 'undefined') {
      const isBookmarked = BookmarksManager.isChapterBookmarked(currentBook.id, chapter.id);
      updateBookmarkToggleState(isBookmarked);
    }

    // Actualizar TOC activo
    const items = chaptersListEl.querySelectorAll('.chapter-item');
    items.forEach((item, idx) => {
      const isActive = (idx === index);
      item.classList.toggle('active', isActive);
      item.classList.toggle('read', idx < index);
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

      // Aplicar resaltados y anotaciones guardadas para este capítulo
      if (typeof StorageAdapter !== 'undefined' && typeof AnnotationsEngine !== 'undefined') {
        const chapterAnnotations = StorageAdapter.getAnnotations(currentBook.id, chapter.id);
        AnnotationsEngine.applyAllHighlights(readerContentEl, chapterAnnotations);
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
    hideSelectionPopover();
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Reader;
}
