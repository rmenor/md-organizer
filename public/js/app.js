// Athenaeum - Cliente de Biblioteca (2026)
document.addEventListener('DOMContentLoaded', () => {
  Reader.init();

  // Estado global
  let libraryTree = [];
  let allBooksList = [];
  let currentFilter = { type: 'all', label: 'Libros', id: null };
  let selectedFile = null;

  // Elementos DOM de cabecera y navegación
  const topbarTitle = document.getElementById('topbar-title');
  const topbarSubtitle = document.getElementById('topbar-subtitle');
  const btnBackToGrid = document.getElementById('btn-back-to-grid');
  const btnSearchToggle = document.getElementById('btn-search-toggle');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const btnLangToggle = document.getElementById('btn-lang-toggle');
  const searchDrawer = document.getElementById('search-drawer');
  const globalSearchInput = document.getElementById('global-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const btnCloseSearch = document.getElementById('btn-close-search');

  // Sub-pestañas y acciones de cabecera
  const subtabButtons = document.querySelectorAll('.subtab-btn');
  const tabBtnPublications = document.getElementById('tab-btn-publications');
  const btnTopbarUpload = document.getElementById('btn-topbar-upload');
  const tabBtnUpdates = document.getElementById('tab-btn-updates');
  const tabBtnWiki = document.getElementById('tab-btn-wiki');

  // Vistas principales
  const categoryView = document.getElementById('category-view');
  const publicationsView = document.getElementById('publications-view');
  const updatesView = document.getElementById('updates-view');
  const wikiView = document.getElementById('wiki-view');

  // Publicaciones y libros
  const categoryTilesGrid = document.getElementById('category-tiles-grid');
  const btnReturnGrid = document.getElementById('btn-return-grid');
  const activeCategoryTitle = document.getElementById('active-category-title');
  const activeCategoryCount = document.getElementById('active-category-count');
  const btnQuickUpload = document.getElementById('btn-quick-upload');
  const booksContainer = document.getElementById('books-container');
  const emptyState = document.getElementById('empty-state');
  const btnEmptyUpload = document.getElementById('btn-empty-upload');
  const tileBooksCount = document.getElementById('tile-books-count');

  // Actualizaciones y Versiones
  const updatesCardsContainer = document.getElementById('updates-cards-container');

  // Modal Upload
  const uploadModal = document.getElementById('upload-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelUpload = document.getElementById('btn-cancel-upload');
  const dropZone = document.getElementById('drop-zone');
  const zipFileInput = document.getElementById('zip-file-input');
  const fileChosenInfo = document.getElementById('file-chosen-info');
  const chosenFileName = document.getElementById('chosen-file-name');
  const chosenFileSize = document.getElementById('chosen-file-size');
  const btnSubmitUpload = document.getElementById('btn-submit-upload');
  const uploadProgress = document.getElementById('upload-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const modalAlert = document.getElementById('modal-alert');

  // Guía y Wiki (Sección principal)
  const btnCopyTemplate = document.getElementById('btn-copy-template');
  const jsonTemplateCode = document.getElementById('json-template-code');
  const wikiTabChips = document.querySelectorAll('.wiki-tab-chip');
  const wikiPanes = document.querySelectorAll('.wiki-pane');
  const wikiMarkdownContainer = document.getElementById('wiki-markdown-container');

  // Backdrop
  const appBackdrop = document.getElementById('app-backdrop');

  // Modal Confirmación de Eliminación
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalBookTitle = document.getElementById('delete-modal-book-title');
  const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  let bookToDelete = null;

  // Modal Backup y Restore
  const btnBackupToggle = document.getElementById('btn-backup-toggle');
  const backupModal = document.getElementById('backup-modal');
  const btnCloseBackupModal = document.getElementById('btn-close-backup-modal');
  const btnCancelBackupModal = document.getElementById('btn-cancel-backup-modal');
  const backupTabBtns = document.querySelectorAll('.backup-tab-btn');
  const backupPanes = document.querySelectorAll('.backup-pane');
  const backupStatBooks = document.getElementById('backup-stat-books');
  const backupStatChapters = document.getElementById('backup-stat-chapters');
  const backupStatSections = document.getElementById('backup-stat-sections');
  const backupDropZone = document.getElementById('backup-drop-zone');
  const backupFileInput = document.getElementById('backup-file-input');
  const backupFileChosenInfo = document.getElementById('backup-file-chosen-info');
  const backupChosenFileName = document.getElementById('backup-chosen-file-name');
  const backupChosenFileSize = document.getElementById('backup-chosen-file-size');
  const backupInspectionCard = document.getElementById('backup-inspection-card');
  const inspectBackupDate = document.getElementById('inspect-backup-date');
  const inspectAppVer = document.getElementById('inspect-app-ver');
  const inspectBooksCount = document.getElementById('inspect-books-count');
  const inspectChaptersCount = document.getElementById('inspect-chapters-count');
  const inspectFilesCount = document.getElementById('inspect-files-count');
  const backupRestoreProgress = document.getElementById('backup-restore-progress');
  const backupProgressBarFill = document.getElementById('backup-progress-bar-fill');
  const backupProgressText = document.getElementById('backup-progress-text');
  const backupModalAlert = document.getElementById('backup-modal-alert');
  const btnConfirmRestore = document.getElementById('btn-confirm-restore');
  let selectedBackupFile = null;

  // Modal Integridad SHA-256
  const integrityModal = document.getElementById('integrity-modal');
  const btnCloseIntegrityModal = document.getElementById('btn-close-integrity-modal');
  const btnCloseIntegrityBtn = document.getElementById('btn-close-integrity-btn');
  const btnReverifyIntegrity = document.getElementById('btn-reverify-integrity');
  const integrityBookTitle = document.getElementById('integrity-book-title');
  const integrityBookMeta = document.getElementById('integrity-book-meta');
  const integrityGlobalStatus = document.getElementById('integrity-global-status');
  const integrityCompositeHash = document.getElementById('integrity-composite-hash');
  const btnCopyBookHash = document.getElementById('btn-copy-book-hash');
  const integrityChaptersTbody = document.getElementById('integrity-chapters-tbody');
  const integrityModalAlert = document.getElementById('integrity-modal-alert');
  let currentIntegrityBookId = null;

  // Modal Historial de Versiones y Changelog
  const versionsModal = document.getElementById('versions-modal');
  const btnCloseVersionsModal = document.getElementById('btn-close-versions-modal');
  const btnCloseVersionsBtn = document.getElementById('btn-close-versions-btn');
  const versionsBookTitle = document.getElementById('versions-book-title');
  const versionsBookMeta = document.getElementById('versions-book-meta');
  const bookStateSelector = document.getElementById('book-state-selector');
  const versionsTimelineList = document.getElementById('versions-timeline-list');
  const btnOpenCompareFromVersions = document.getElementById('btn-open-compare-from-versions');
  const versionsModalAlert = document.getElementById('versions-modal-alert');
  let currentVersionsBookId = null;

  // Modal Comparación entre Versiones (Diff)
  const compareModal = document.getElementById('compare-modal');
  const btnCloseCompareModal = document.getElementById('btn-close-compare-modal');
  const btnCloseCompareBtn = document.getElementById('btn-close-compare-btn');
  const compareVersionA = document.getElementById('compare-version-a');
  const compareVersionB = document.getElementById('compare-version-b');
  const btnExecuteCompare = document.getElementById('btn-execute-compare');
  const compareSemverBadge = document.getElementById('compare-semver-badge');
  const compareChaptersBreakdown = document.getElementById('compare-chapters-breakdown');
  const compareWordsDelta = document.getElementById('compare-words-delta');
  const compareAssetsBreakdown = document.getElementById('compare-assets-breakdown');
  const compareChaptersTbody = document.getElementById('compare-chapters-tbody');
  const compareAssetsTbody = document.getElementById('compare-assets-tbody');
  const compareDiffViewer = document.getElementById('compare-diff-viewer');
  const diffViewerTitle = document.getElementById('diff-viewer-title');
  const btnCloseDiff = document.getElementById('btn-close-diff');
  const diffLinesContainer = document.getElementById('diff-lines-container');
  const compareModalAlert = document.getElementById('compare-modal-alert');
  let currentCompareBookId = null;



  // Utilidad para sanitizar texto HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeMarkdownFragment(markdown) {
    const parsed = new DOMParser().parseFromString(marked.parse(String(markdown || '')), 'text/html');
    const allowed = new Set([
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI', 'A', 'IMG',
      'PRE', 'CODE', 'BLOCKQUOTE', 'EM', 'STRONG', 'DEL', 'BR', 'HR',
      'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
      'SPAN', 'DIV', 'I', 'B', 'S', 'KBD', 'SUP', 'SUB', 'MARK', 'SMALL'
    ]);
    const fragment = document.createDocumentFragment();
    const safeUrl = (value, image = false) => {
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

  // Iconos acordes a la temática de cada sección
  function getSectionIcon(name) {
    const n = (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes('software') || n.includes('programacion') || n.includes('codigo') || n.includes('desarrollo') || n.includes('dev') || n.includes('ingenieria')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>`;
    }
    if (n.includes('base') || n.includes('dato') || n.includes('sql') || n.includes('almacen') || n.includes('storage')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>`;
    }
    if (n.includes('diseno') || n.includes('ui') || n.includes('ux') || n.includes('web') || n.includes('front') || n.includes('css')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="9" y1="21" x2="9" y2="9"></line>
      </svg>`;
    }
    if (n.includes('red') || n.includes('cloud') || n.includes('nube') || n.includes('servidor') || n.includes('devops') || n.includes('seguridad') || n.includes('infra')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <line x1="6" y1="6" x2="6.01" y2="6"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
      </svg>`;
    }
    if (n.includes('guia') || n.includes('manual') || n.includes('doc') || n.includes('referencia') || n.includes('tutorial')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>`;
    }
    if (n.includes('ia') || n.includes('inteligencia') || n.includes('machine') || n.includes('learning') || n.includes('ai')) {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
      </svg>`;
    }
    // Icono general de carpeta / categoría
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>`;
  }

  // Renderizar la cuadrícula de categorías y secciones dinámicamente
  function renderCategoryTiles() {
    if (!categoryTilesGrid) return;
    categoryTilesGrid.innerHTML = '';

    // 1. Baldosa principal: Todos los libros
    const totalCount = allBooksList.length;
    const allTile = document.createElement('div');
    allTile.className = 'category-tile';
    allTile.setAttribute('data-action', 'filter-all');
    allTile.tabIndex = 0;
    allTile.innerHTML = `
      <div class="tile-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
          <path d="M6 6h10"></path>
          <path d="M6 10h10"></path>
        </svg>
      </div>
      <div class="tile-info">
        <span class="tile-title">Libros</span>
        <span class="tile-meta" id="tile-books-count">${totalCount} ${totalCount === 1 ? 'disponible' : 'disponibles'}</span>
      </div>
    `;
    categoryTilesGrid.appendChild(allTile);

    // 2. Baldosas para cada sección creada a partir de los libros
    libraryTree.forEach(section => {
      let secCount = 0;
      if (section.subsections) {
        section.subsections.forEach(sub => {
          secCount += (sub.books || []).length;
        });
      }

      const secTile = document.createElement('div');
      secTile.className = 'category-tile';
      secTile.setAttribute('data-action', 'filter-section');
      secTile.setAttribute('data-section', section.name);
      secTile.setAttribute('data-section-id', section.id);
      secTile.tabIndex = 0;

      secTile.innerHTML = `
        <div class="tile-icon">
          ${getSectionIcon(section.name)}
        </div>
        <div class="tile-info">
          <span class="tile-title" title="${escapeHtml(section.name)}">${escapeHtml(section.name)}</span>
          <span class="tile-meta">${secCount} ${secCount === 1 ? 'disponible' : 'disponibles'}</span>
        </div>
      `;
      categoryTilesGrid.appendChild(secTile);
    });
  }

  // ==========================================
  // INICIALIZACIÓN Y CARGA DE DATOS
  // ==========================================
  async function loadLibrary() {
    try {
      const res = await fetch('/api/tree');
      if (!res.ok) throw new Error('Error al conectar con la biblioteca');
      libraryTree = await res.json();

      // Consolidar todos los libros en una lista plana
      allBooksList = [];
      libraryTree.forEach(section => {
        section.subsections.forEach(sub => {
          sub.books.forEach(book => {
            allBooksList.push({
              ...book,
              section_id: section.id,
              section_name: section.name,
              subsection_id: sub.id,
              subsection_name: sub.name
            });
          });
        });
      });

      if (tileBooksCount) {
        tileBooksCount.textContent = `${allBooksList.length} disponibles`;
      }

      renderCategoryTiles();
      renderUpdatesView();
    } catch (err) {
      console.error('Error cargando biblioteca:', err);
    }
  }

  // ==========================================
  // NAVEGACIÓN Y VISTAS
  // ==========================================
  function showMainView(viewName) {
    // Desactivar todas las vistas
    categoryView.classList.add('hidden');
    publicationsView.classList.add('hidden');
    updatesView.classList.add('hidden');
    if (wikiView) wikiView.classList.add('hidden');

    // Desactivar clases activas de pestañas e iconos
    subtabButtons.forEach(btn => btn.classList.remove('active'));
    if (btnHistoryToggle) btnHistoryToggle.classList.remove('active');

    if (viewName === 'publications') {
      categoryView.classList.remove('hidden');
      tabBtnPublications.classList.add('active');
      btnBackToGrid.classList.add('hidden');
      topbarTitle.textContent = 'Biblioteca';
      topbarSubtitle.textContent = 'Español';
      if (window.location.hash === '#wiki' || window.location.hash === '#updates') {
        history.replaceState(null, '', ' ');
      }
    } else if (viewName === 'updates') {
      updatesView.classList.remove('hidden');
      if (tabBtnUpdates) tabBtnUpdates.classList.add('active');
      if (btnHistoryToggle) btnHistoryToggle.classList.add('active');
      btnBackToGrid.classList.remove('hidden');
      topbarTitle.textContent = 'Versiones';
      topbarSubtitle.textContent = 'Control de Actualizaciones';
      window.location.hash = '#updates';
    } else if (viewName === 'wiki') {
      if (wikiView) wikiView.classList.remove('hidden');
      tabBtnWiki.classList.add('active');
      btnBackToGrid.classList.remove('hidden');
      topbarTitle.textContent = 'Guía';
      topbarSubtitle.textContent = 'Documentación & Formato';
      window.location.hash = '#wiki';
      loadWikiDoc();
    }
  }

  function openPublicationsView(filterType, label, filterId = null) {
    currentFilter = { type: filterType, label, id: filterId };

    categoryView.classList.add('hidden');
    updatesView.classList.add('hidden');
    if (wikiView) wikiView.classList.add('hidden');
    publicationsView.classList.remove('hidden');

    tabBtnPublications.classList.add('active');
    btnBackToGrid.classList.remove('hidden');

    if (activeCategoryTitle) activeCategoryTitle.textContent = label;
    topbarTitle.textContent = label;
    topbarSubtitle.textContent = 'Publicaciones';

    renderFilteredBooks();
  }

  function renderFilteredBooks() {
    booksContainer.innerHTML = '';

    let filtered = [];
    if (currentFilter.type === 'all') {
      filtered = allBooksList;
    } else if (currentFilter.type === 'section') {
      filtered = allBooksList.filter(b => b.section_name === currentFilter.label || b.section_id === currentFilter.id);
    } else if (currentFilter.type === 'subsection') {
      filtered = allBooksList.filter(b => b.subsection_id === currentFilter.id);
    } else if (currentFilter.type === 'search') {
      const q = (currentFilter.query || '').toLowerCase();
      filtered = allBooksList.filter(b => 
        (b.title || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.code || '').toLowerCase().includes(q) ||
        (b.section_name || '').toLowerCase().includes(q)
      );
    }

    if (activeCategoryCount) activeCategoryCount.textContent = filtered.length;

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    const coverPalette = ['cover-emerald', 'cover-ruby', 'cover-navy', 'cover-purple', 'cover-obsidian'];

    filtered.forEach((book, index) => {
      const card = document.createElement('div');
      card.className = 'book-grid-card';
      card.tabIndex = 0;
      card.title = String(book.title || '');

      const coverClass = coverPalette[index % coverPalette.length];
      const hasRealCover = Boolean(book.cover_image);
      const coverImgSrc = hasRealCover 
        ? `/api/books/${book.id}/assets/${encodeURIComponent(book.cover_image.replace(/^assets\//, ''))}`
        : '';

      card.innerHTML = `
        <div class="book-cover-wrap ${coverClass}">
          ${hasRealCover ? `<img src="${escapeHtml(coverImgSrc)}" alt="${escapeHtml(book.title)}" class="book-real-cover">` : ''}
          <div class="book-cover-inner">
          <span class="book-cover-title-emboss">${escapeHtml(book.title)}</span>
          </div>
          <button class="btn-book-integrity" data-book-id="${escapeHtml(book.id)}" title="Verificar integridad SHA-256">🛡️</button>
          <button class="btn-book-delete" data-book-id="${escapeHtml(book.id)}" title="Eliminar publicación">✕</button>
        </div>
        <div class="book-card-info">
          <div class="book-title-label">${escapeHtml(book.title)}</div>
        </div>
      `;

      const realCover = card.querySelector('.book-real-cover');
      realCover?.addEventListener('error', () => realCover.remove(), { once: true });

      card.querySelector('.btn-book-integrity')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openIntegrityModal(book.id);
      });

      card.querySelector('.btn-book-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(book);
      });

      card.addEventListener('click', () => {
        Reader.openBook(book.id);
      });

      booksContainer.appendChild(card);
    });
  }

  async function deleteBook(id) {
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el libro');
      await loadLibrary();
      renderFilteredBooks();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ==========================================
  // RENDERIZADO DE ACTUALIZACIONES
  // ==========================================
  function renderUpdatesView() {
    updatesCardsContainer.innerHTML = '';

    if (allBooksList.length === 0) {
      updatesCardsContainer.innerHTML = '<p style="color: var(--app-text-dim);">No hay libros registrados en la base de datos.</p>';
      return;
    }

    allBooksList.forEach(book => {
      const item = document.createElement('div');
      item.className = 'updates-card-item';

      let stateBadge = '<span class="state-pill published">🟢 Publicado</span>';
      if (book.state === 'draft') {
        stateBadge = '<span class="state-pill draft">🟡 Borrador</span>';
      } else if (book.state === 'archived') {
        stateBadge = '<span class="state-pill archived">⚪ Archivado</span>';
      }

      item.innerHTML = `
        <div class="update-book-info">
          <h4>${escapeHtml(book.title)}</h4>
          <div class="update-book-meta">
            <span>Código: <strong>${escapeHtml(book.code)}</strong></span> ·
            <span>Versión: <strong>v${escapeHtml(book.version)}</strong></span> ·
            <span>Fecha: <strong>${escapeHtml(book.publication_date ? book.publication_date.substring(0, 10) : 'N/A')}</strong></span> ·
            ${stateBadge}
          </div>
          ${book.changelog ? `<div style="font-size:0.78rem; color:var(--app-text-muted); margin-top:0.35rem; white-space:pre-line;">${escapeHtml(book.changelog.length > 140 ? book.changelog.substring(0, 140) + '...' : book.changelog)}</div>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn-sm-action btn-open-versions" data-book-id="${escapeHtml(book.id)}" title="Ver historial de versiones y notas de versión">
            📜 Historial & Changelog
          </button>
          <button class="btn-sm-action btn-open-compare" data-book-id="${escapeHtml(book.id)}" title="Comparar dos versiones de este libro">
            ⚖️ Comparar
          </button>
          <button class="badge-integrity" data-book-id="${escapeHtml(book.id)}" title="Verificar integridad criptográfica SHA-256">
            🛡️ SHA-256
          </button>
        </div>
      `;

      item.querySelector('.btn-open-versions')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openVersionsModal(book.id);
      });

      item.querySelector('.btn-open-compare')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openCompareModal(book.id);
      });

      item.querySelector('.badge-integrity')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openIntegrityModal(book.id);
      });

      updatesCardsContainer.appendChild(item);
    });
  }

  // ==========================================
  // EVENT LISTENERS DE NAVEGACIÓN Y BALDOSAS
  // ==========================================
  // Delegación de eventos en las baldosas de la cuadrícula principal
  if (categoryTilesGrid) {
    categoryTilesGrid.addEventListener('click', (e) => {
      const tile = e.target.closest('.category-tile');
      if (!tile) return;
      const action = tile.getAttribute('data-action');
      const secName = tile.getAttribute('data-section');
      const secId = tile.getAttribute('data-section-id');

      if (action === 'filter-all') {
        openPublicationsView('all', 'Libros');
      } else if (action === 'filter-section' && secName) {
        openPublicationsView('section', secName, secId ? parseInt(secId, 10) : null);
      } else if (action === 'open-sections') {
        showMainView('sections');
      } else if (action === 'open-updates') {
        showMainView('updates');
      } else if (action === 'open-wiki') {
        openWiki();
      }
    });

    categoryTilesGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tile = e.target.closest('.category-tile');
        if (tile) {
          e.preventDefault();
          tile.click();
        }
      }
    });
  }

  // Botón Atrás y Clic en Título Central "Biblioteca"
  btnBackToGrid.addEventListener('click', () => {
    showMainView('publications');
  });

  const topbarCenterEl = document.querySelector('.topbar-center');
  if (topbarCenterEl) {
    topbarCenterEl.style.cursor = 'pointer';
    topbarCenterEl.setAttribute('title', 'Volver al inicio de la biblioteca');
    topbarCenterEl.addEventListener('click', () => {
      Reader.closeReader();
      showMainView('publications');
    });
  }

  const brandDecorEl = document.getElementById('brand-decor');
  if (brandDecorEl) {
    brandDecorEl.addEventListener('click', () => {
      Reader.closeReader();
      showMainView('publications');
    });
  }

  if (btnReturnGrid) {
    btnReturnGrid.addEventListener('click', () => {
      showMainView('publications');
    });
  }

  // Refrescar insignias de progreso de lectura al cerrar el lector
  window.addEventListener('reader:closed', () => {
    if (publicationsView && !publicationsView.classList.contains('hidden')) {
      renderFilteredBooks();
    }
  });

  // Pestañas Sub-bar
  if (tabBtnPublications) {
    tabBtnPublications.addEventListener('click', () => {
      showMainView('publications');
      tabBtnPublications.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  }
  if (tabBtnUpdates) {
    tabBtnUpdates.addEventListener('click', () => {
      showMainView('updates');
      tabBtnUpdates.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  }
  if (tabBtnWiki) {
    tabBtnWiki.addEventListener('click', () => openWiki());
  }

  // Botón Subir en el Navbar
  if (btnTopbarUpload) {
    btnTopbarUpload.addEventListener('click', () => openUploadModal());
  }

  // Soporte de desplazamiento horizontal táctil y por arrastre en la barra de pestañas
  const subtabsContainer = document.querySelector('.app-subtabs');
  if (subtabsContainer) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    subtabsContainer.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - subtabsContainer.offsetLeft;
      scrollLeft = subtabsContainer.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
    });

    subtabsContainer.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - subtabsContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      subtabsContainer.scrollLeft = scrollLeft - walk;
    });
  }

  // Buscador
  btnSearchToggle.addEventListener('click', () => {
    searchDrawer.classList.toggle('hidden');
    if (!searchDrawer.classList.contains('hidden')) {
      globalSearchInput.focus();
    }
  });

  btnCloseSearch.addEventListener('click', () => {
    searchDrawer.classList.add('hidden');
    globalSearchInput.value = '';
    btnClearSearch.classList.add('hidden');
  });

  globalSearchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) {
      btnClearSearch.classList.remove('hidden');
      openPublicationsView('search', `Búsqueda: "${val}"`);
      currentFilter.query = val;
      renderFilteredBooks();
    } else {
      btnClearSearch.classList.add('hidden');
      openPublicationsView('all', 'Libros');
    }
  });

  btnClearSearch.addEventListener('click', () => {
    globalSearchInput.value = '';
    btnClearSearch.classList.add('hidden');
    openPublicationsView('all', 'Libros');
  });

  // Historial rápido / Control de Actualizaciones
  if (btnHistoryToggle) {
    btnHistoryToggle.addEventListener('click', () => {
      if (updatesView && !updatesView.classList.contains('hidden')) {
        showMainView('publications');
      } else {
        showMainView('updates');
      }
    });
  }

  // Idioma / Tema rápido
  btnLangToggle.addEventListener('click', () => {
    const currentTheme = document.body.className.includes('theme-light') ? 'light' : 
                         document.body.className.includes('theme-sepia') ? 'sepia' : 'dark';
    const nextTheme = currentTheme === 'dark' ? 'sepia' : currentTheme === 'sepia' ? 'light' : 'dark';
    document.body.className = `theme-${nextTheme}`;
  });

  // ==========================================
  // MODAL DE SUBIDA ZIP
  // ==========================================
  function openUploadModal() {
    uploadModal.classList.remove('hidden');
    resetUploadModal();
  }

  function closeUploadModal() {
    uploadModal.classList.add('hidden');
    resetUploadModal();
  }

  function resetUploadModal() {
    selectedFile = null;
    zipFileInput.value = '';
    fileChosenInfo.classList.add('hidden');
    btnSubmitUpload.disabled = true;
    uploadProgress.classList.add('hidden');
    progressBarFill.style.width = '0%';
    modalAlert.className = 'alert-message hidden';
    modalAlert.textContent = '';
  }

  if (btnQuickUpload) btnQuickUpload.addEventListener('click', openUploadModal);
  if (btnEmptyUpload) btnEmptyUpload.addEventListener('click', openUploadModal);
  btnCloseModal.addEventListener('click', closeUploadModal);
  btnCancelUpload.addEventListener('click', closeUploadModal);

  uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) closeUploadModal();
  });

  dropZone.addEventListener('click', () => zipFileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  });

  zipFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChosen(e.target.files[0]);
    }
  });

  function handleFileChosen(file) {
    const fileNameLower = (file.name || '').toLowerCase();
    if (!fileNameLower.endsWith('.zip') && !fileNameLower.endsWith('.mdz')) {
      showModalAlert('Solo se admiten archivos comprimidos en formato .zip o .mdz', 'error');
      return;
    }

    selectedFile = file;
    chosenFileName.textContent = file.name;
    chosenFileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    fileChosenInfo.classList.remove('hidden');
    btnSubmitUpload.disabled = false;
    modalAlert.classList.add('hidden');
  }

  function showModalAlert(msg, type = 'error') {
    modalAlert.className = `alert-message ${type}`;
    modalAlert.textContent = msg;
    modalAlert.classList.remove('hidden');
  }

  btnSubmitUpload.addEventListener('click', async () => {
    if (!selectedFile) return;

    btnSubmitUpload.disabled = true;
    uploadProgress.classList.remove('hidden');
    progressBarFill.style.width = '35%';

    const formData = new FormData();
    formData.append('zipFile', selectedFile);
    formData.append('zipfile', selectedFile);

    try {
      progressBarFill.style.width = '70%';
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      progressBarFill.style.width = '100%';
      const data = await res.json();

      if (res.status === 409) {
        showModalAlert(`⚠️ Advertencia de versión: ${data.error}`, 'error');
        btnSubmitUpload.disabled = false;
        return;
      }

      if (res.status === 422) {
        const bullets = data.validationErrors
          ? data.validationErrors.map(e => `• ${e}`).join('\n')
          : data.error;
        showModalAlert(`❌ El archivo no pasó la validación:\n\n${bullets}`, 'error');
        btnSubmitUpload.disabled = false;
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Error al subir la publicación');
      }


      showModalAlert(`✓ Publicación "${data.book.title}" organizada con éxito.`, 'success');
      await loadLibrary();

      setTimeout(() => {
        closeUploadModal();
        openPublicationsView('all', 'Libros');
      }, 1200);
    } catch (err) {
      showModalAlert(err.message, 'error');
      btnSubmitUpload.disabled = false;
    }
  });

  // ==========================================
  // GUÍA Y WIKI (SECCIÓN PRINCIPAL)
  // ==========================================
  function openWiki() {
    showMainView('wiki');
  }

  let wikiDocLoaded = false;

  wikiTabChips.forEach(chip => {
    chip.addEventListener('click', () => {
      wikiTabChips.forEach(c => c.classList.remove('active'));
      wikiPanes.forEach(p => p.classList.add('hidden'));

      chip.classList.add('active');
      const target = chip.getAttribute('data-wiki-tab');
      const pane = document.getElementById(`pane-${target}`);
      if (pane) pane.classList.remove('hidden');
      if (target === 'full') {
        loadWikiDoc();
      }
    });
  });

  btnCopyTemplate.addEventListener('click', () => {
    navigator.clipboard.writeText(jsonTemplateCode.textContent).then(() => {
      const origText = btnCopyTemplate.textContent;
      btnCopyTemplate.textContent = '✓ ¡Copiado!';
      setTimeout(() => { btnCopyTemplate.textContent = origText; }, 2000);
    });
  });

  async function loadWikiDoc(force = false) {
    if (wikiDocLoaded && !force) return;
    try {
      const res = await fetch('/api/wiki');
      if (res.ok) {
        const data = await res.json();
        wikiMarkdownContainer.replaceChildren(safeMarkdownFragment(data.content));
        if (window.hljs) {
          wikiMarkdownContainer.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        }
        wikiDocLoaded = true;
        return;
      }
      const resFallback = await fetch('/WIKI_COMO_HACER_LIBROS.md');
      if (!resFallback.ok) throw new Error();
      const md = await resFallback.text();
      wikiMarkdownContainer.replaceChildren(safeMarkdownFragment(md));
      if (window.hljs) {
        wikiMarkdownContainer.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
      }
      wikiDocLoaded = true;
    } catch {
      wikiMarkdownContainer.innerHTML = '<p>Consulta la pestaña Guía Rápida para conocer la estructura de archivos.</p>';
    }
  }

  // ==========================================
  // MODAL CONFIRMACIÓN DE ELIMINACIÓN
  // ==========================================
  function openDeleteModal(book) {
    bookToDelete = book;
    if (deleteModalBookTitle) {
      deleteModalBookTitle.textContent = book.title;
    }
    deleteModal.classList.remove('hidden');
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = 'Eliminar Libro';
  }

  function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    bookToDelete = null;
  }

  if (btnCloseDeleteModal) {
    btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  }
  if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', closeDeleteModal);
  }

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!bookToDelete) return;
      btnConfirmDelete.disabled = true;
      btnConfirmDelete.textContent = 'Eliminando...';
      await deleteBook(bookToDelete.id);
      closeDeleteModal();
    });
  }

  // ==========================================
  // MODAL COPIAS DE SEGURIDAD (BACKUP & RESTORE)
  // ==========================================
  function showBackupAlert(msg, type = 'error') {
    if (!backupModalAlert) return;
    backupModalAlert.textContent = msg;
    backupModalAlert.className = `alert-message ${type}`;
    backupModalAlert.classList.remove('hidden');
  }

  function hideBackupAlert() {
    if (backupModalAlert) backupModalAlert.classList.add('hidden');
  }

  function openBackupModal(activeTab = 'export') {
    hideBackupAlert();
    selectedBackupFile = null;
    if (backupFileInput) backupFileInput.value = '';
    if (backupFileChosenInfo) backupFileChosenInfo.classList.add('hidden');
    if (backupInspectionCard) backupInspectionCard.classList.add('hidden');
    if (backupRestoreProgress) backupRestoreProgress.classList.add('hidden');
    if (btnConfirmRestore) {
      btnConfirmRestore.disabled = true;
      btnConfirmRestore.classList.add('hidden');
      btnConfirmRestore.textContent = 'Confirmar y Restaurar';
    }

    // Calcular estadísticas actuales de la biblioteca
    let booksCount = allBooksList.length;
    let chaptersCount = 0;
    let sectionsCount = Array.isArray(libraryTree) ? libraryTree.length : 0;

    allBooksList.forEach(b => {
      chaptersCount += (b.total_chapters || 0);
    });


    if (backupStatBooks) backupStatBooks.textContent = String(booksCount);
    if (backupStatChapters) backupStatChapters.textContent = String(chaptersCount);
    if (backupStatSections) backupStatSections.textContent = String(sectionsCount);

    // Cambiar a la pestaña correspondiente
    switchBackupTab(activeTab);

    if (backupModal) backupModal.classList.remove('hidden');
  }

  function closeBackupModal() {
    if (backupModal) backupModal.classList.add('hidden');
  }

  function switchBackupTab(tabName) {
    hideBackupAlert();
    backupTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-backup-tab') === tabName);
    });
    backupPanes.forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `backup-pane-${tabName}`);
    });
  }

  backupTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-backup-tab');
      switchBackupTab(target);
    });
  });

  if (btnBackupToggle) {
    btnBackupToggle.addEventListener('click', () => openBackupModal('export'));
  }
  if (btnCloseBackupModal) {
    btnCloseBackupModal.addEventListener('click', closeBackupModal);
  }
  if (btnCancelBackupModal) {
    btnCancelBackupModal.addEventListener('click', closeBackupModal);
  }
  if (backupModal) {
    backupModal.addEventListener('click', (e) => {
      if (e.target === backupModal) closeBackupModal();
    });
  }

  // Zona de arrastre y selección de archivo para restaurar
  if (backupDropZone && backupFileInput) {
    backupDropZone.addEventListener('click', () => backupFileInput.click());

    backupDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      backupDropZone.classList.add('dragover');
    });

    backupDropZone.addEventListener('dragleave', () => {
      backupDropZone.classList.remove('dragover');
    });

    backupDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      backupDropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleBackupFileChosen(e.dataTransfer.files[0]);
      }
    });

    backupFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleBackupFileChosen(e.target.files[0]);
      }
    });
  }

  async function handleBackupFileChosen(file) {
    hideBackupAlert();
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showBackupAlert('Solo se permiten archivos de copia de seguridad en formato .zip', 'error');
      return;
    }

    selectedBackupFile = file;
    if (backupChosenFileName) backupChosenFileName.textContent = file.name;
    if (backupChosenFileSize) backupChosenFileSize.textContent = `(${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    if (backupFileChosenInfo) backupFileChosenInfo.classList.remove('hidden');

    // Pre-flight inspection automática
    if (backupRestoreProgress) {
      backupRestoreProgress.classList.remove('hidden');
      if (backupProgressBarFill) backupProgressBarFill.style.width = '40%';
      if (backupProgressText) backupProgressText.textContent = 'Inspeccionando y verificando integridad del archivo...';
    }

    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      const res = await fetch('/api/backup/inspect', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (backupRestoreProgress) backupRestoreProgress.classList.add('hidden');

      if (!res.ok) {
        throw new Error(data.error || 'El archivo no es una copia de seguridad válida.');
      }

      // Mostrar tarjeta de inspección previa
      if (inspectBackupDate) {
        const d = new Date(data.created_at);
        inspectBackupDate.textContent = isNaN(d.getTime()) ? data.created_at : d.toLocaleString('es-ES');
      }
      if (inspectAppVer) inspectAppVer.textContent = data.app_version || '1.0.0';
      if (inspectBooksCount) inspectBooksCount.textContent = `${data.stats.booksCount || 0} libros`;
      if (inspectChaptersCount) inspectChaptersCount.textContent = `${data.stats.chaptersCount || 0} capítulos`;
      if (inspectFilesCount) inspectFilesCount.textContent = `${data.libraryFilesCount || 0} archivos`;

      if (backupInspectionCard) backupInspectionCard.classList.remove('hidden');
      if (btnConfirmRestore) {
        btnConfirmRestore.classList.remove('hidden');
        btnConfirmRestore.disabled = false;
      }
    } catch (err) {
      if (backupRestoreProgress) backupRestoreProgress.classList.add('hidden');
      if (backupInspectionCard) backupInspectionCard.classList.add('hidden');
      if (btnConfirmRestore) btnConfirmRestore.classList.add('hidden');
      showBackupAlert(`❌ Error de verificación: ${err.message}`, 'error');
    }
  }

  if (btnConfirmRestore) {
    btnConfirmRestore.addEventListener('click', async () => {
      if (!selectedBackupFile) return;

      btnConfirmRestore.disabled = true;
      btnConfirmRestore.textContent = 'Restaurando...';
      hideBackupAlert();

      if (backupRestoreProgress) {
        backupRestoreProgress.classList.remove('hidden');
        if (backupProgressBarFill) backupProgressBarFill.style.width = '65%';
        if (backupProgressText) backupProgressText.textContent = 'Restaurando base de datos, libros y re-mapeando rutas...';
      }

      const formData = new FormData();
      formData.append('backupFile', selectedBackupFile);

      try {
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          body: formData
        });

        if (backupProgressBarFill) backupProgressBarFill.style.width = '100%';
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Error al restaurar la copia de seguridad.');
        }

        showBackupAlert(`✓ ${data.message || 'Copia de seguridad restaurada con éxito.'}`, 'success');
        await loadLibrary();

        setTimeout(() => {
          closeBackupModal();
          showMainView('publications');
        }, 1500);
      } catch (err) {
        if (backupRestoreProgress) backupRestoreProgress.classList.add('hidden');
        btnConfirmRestore.disabled = false;
        btnConfirmRestore.textContent = 'Confirmar y Restaurar';
        showBackupAlert(err.message, 'error');
      }
    });
  }


  // ==========================================
  // MODAL DE INTEGRIDAD SHA-256
  // ==========================================
  async function openIntegrityModal(bookId) {
    if (!integrityModal) return;
    currentIntegrityBookId = bookId;
    integrityModal.classList.remove('hidden');
    if (integrityModalAlert) integrityModalAlert.classList.add('hidden');
    if (integrityChaptersTbody) {
      integrityChaptersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--app-text-dim);">Calculando huellas criptográficas SHA-256...</td></tr>';
    }
    if (integrityGlobalStatus) {
      integrityGlobalStatus.className = 'integrity-status-pill';
      integrityGlobalStatus.textContent = 'Verificando...';
    }
    if (integrityCompositeHash) integrityCompositeHash.textContent = 'Calculando...';

    const book = allBooksList.find(b => b.id === bookId);
    if (book) {
      if (integrityBookTitle) integrityBookTitle.textContent = book.title;
      if (integrityBookMeta) integrityBookMeta.textContent = `v${book.version || '1.0.0'} • Código: ${book.code || 'N/A'}`;
    }

    await loadIntegrityReport(bookId);
  }

  function closeIntegrityModal() {
    if (!integrityModal) return;
    integrityModal.classList.add('hidden');
    currentIntegrityBookId = null;
  }

  async function fetchJsonSafely(url, options = {}) {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const isHtml = contentType.includes('text/html');
      if (res.status === 404) {
        throw new Error('El endpoint solicitado no fue encontrado en el servidor (HTTP 404). Si el despliegue está en curso, recarga en unos instantes.');
      }
      throw new Error(`El servidor respondió con error ${res.status}${isHtml ? ' (página HTML)' : ''}. Por favor, recarga la aplicación.`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Error en la solicitud (HTTP ${res.status})`);
    }
    return data;
  }

  async function loadIntegrityReport(bookId) {
    try {
      const data = await fetchJsonSafely(`/api/books/${bookId}/integrity`);

      if (integrityBookTitle) integrityBookTitle.textContent = data.title || 'Publicación';
      if (integrityBookMeta) integrityBookMeta.textContent = `v${data.version || '1.0.0'} • Código: ${data.code || 'N/A'} • Total Capítulos: ${data.total_chapters || 0}`;
      if (integrityCompositeHash) integrityCompositeHash.textContent = data.composite_checksum || data.stored_checksum || 'N/A';

      if (integrityGlobalStatus) {
        if (data.status === 'verified') {
          integrityGlobalStatus.className = 'integrity-status-pill verified';
          integrityGlobalStatus.textContent = '✓ Integridad Verificada';
        } else if (data.status === 'modified') {
          integrityGlobalStatus.className = 'integrity-status-pill modified';
          integrityGlobalStatus.textContent = '⚠ Modificado / Alterado';
        } else {
          integrityGlobalStatus.className = 'integrity-status-pill missing';
          integrityGlobalStatus.textContent = '✕ Archivos Faltantes';
        }
      }

      // Render tabla de capítulos
      if (integrityChaptersTbody) {
        if (data.chapters && data.chapters.length > 0) {
          integrityChaptersTbody.innerHTML = data.chapters.map(c => {
            let statusBadge = '';
            if (c.status === 'verified') {
              statusBadge = '<span class="status-verified">✓ Verificado</span>';
            } else if (c.status === 'modified') {
              statusBadge = '<span class="status-modified" title="El hash del archivo en disco difiere del registrado">⚠ Modificado</span>';
            } else {
              statusBadge = '<span class="status-missing" title="Archivo no encontrado en disco">✕ No existe</span>';
            }

            const hashToShow = c.calculated_checksum || c.stored_checksum || '';
            const shortHash = hashToShow.length > 20
              ? `${hashToShow.substring(0, 8)}...${hashToShow.substring(hashToShow.length - 8)}`
              : (hashToShow || 'N/A');

            return `
              <tr>
                <td><strong>Cap. ${escapeHtml(c.chapter_number)}</strong>: ${escapeHtml(c.title || '')}</td>
                <td class="mono" style="font-size:0.75rem;">${escapeHtml(c.relative_path || '')}</td>
                <td class="mono" title="${escapeHtml(hashToShow)}">${escapeHtml(shortHash)}</td>
                <td>${statusBadge}</td>
              </tr>
            `;
          }).join('');
        } else {
          integrityChaptersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--app-text-dim);">No hay capítulos registrados para auditar.</td></tr>';
        }
      }

    } catch (err) {
      if (integrityGlobalStatus) {
        integrityGlobalStatus.className = 'integrity-status-pill modified';
        integrityGlobalStatus.textContent = 'Error';
      }
      if (integrityModalAlert) {
        integrityModalAlert.textContent = err.message;
        integrityModalAlert.className = 'alert-message error';
        integrityModalAlert.classList.remove('hidden');
      }
    }
  }

  // Listeners para modal de integridad
  btnCloseIntegrityModal?.addEventListener('click', closeIntegrityModal);
  btnCloseIntegrityBtn?.addEventListener('click', closeIntegrityModal);

  btnReverifyIntegrity?.addEventListener('click', () => {
    if (currentIntegrityBookId) {
      loadIntegrityReport(currentIntegrityBookId);
    }
  });

  btnCopyBookHash?.addEventListener('click', () => {
    if (!integrityCompositeHash || !integrityCompositeHash.textContent) return;
    navigator.clipboard.writeText(integrityCompositeHash.textContent).then(() => {
      const orig = btnCopyBookHash.textContent;
      btnCopyBookHash.textContent = '¡Copiado!';
      setTimeout(() => { btnCopyBookHash.textContent = orig; }, 2000);
    }).catch(() => {});
  });

  if (integrityModal) {
    integrityModal.addEventListener('click', (e) => {
      if (e.target === integrityModal) closeIntegrityModal();
    });
  }

  window.openIntegrityModal = openIntegrityModal;

  // ==========================================
  // MODAL DE HISTORIAL DE VERSIONES Y CHANGELOG
  // ==========================================
  async function openVersionsModal(bookId) {
    if (!versionsModal) return;
    currentVersionsBookId = bookId;
    versionsModal.classList.remove('hidden');
    if (versionsModalAlert) versionsModalAlert.classList.add('hidden');
    if (versionsTimelineList) {
      versionsTimelineList.innerHTML = '<p style="text-align:center; padding:1.5rem; color:var(--app-text-muted);">Cargando historial de versiones...</p>';
    }

    const book = allBooksList.find(b => b.id === bookId);
    if (book) {
      if (versionsBookTitle) versionsBookTitle.textContent = book.title;
      if (versionsBookMeta) versionsBookMeta.textContent = `Código: ${book.code} • Versión Activa: v${book.version}`;
      if (bookStateSelector) bookStateSelector.value = book.state || 'published';
    }

    await loadVersionsHistory(bookId);
  }

  function closeVersionsModal() {
    if (!versionsModal) return;
    versionsModal.classList.add('hidden');
    currentVersionsBookId = null;
  }

  async function loadVersionsHistory(bookId) {
    try {
      const data = await fetchJsonSafely(`/api/books/${bookId}/versions`);
      const versions = data.versions || [];
      const book = allBooksList.find(b => b.id === bookId);

      if (versionsTimelineList) {
        if (versions.length === 0) {
          versionsTimelineList.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--app-text-muted);">No hay versiones archivadas para este libro.</p>';
          return;
        }

        versionsTimelineList.innerHTML = versions.map(v => {
          const isActive = book && book.version === v.version;
          let statePill = '<span class="state-pill published">Publicado</span>';
          if (v.state === 'draft') statePill = '<span class="state-pill draft">Borrador</span>';
          else if (v.state === 'archived') statePill = '<span class="state-pill archived">Archivado</span>';

          const dateStr = v.publication_date ? v.publication_date.substring(0, 10) : 'N/A';
          const shortHash = v.checksum ? (v.checksum.substring(0, 8) + '...' + v.checksum.substring(v.checksum.length - 6)) : 'N/A';

          return `
            <div class="timeline-version-card ${isActive ? 'is-active' : ''}">
              <div class="timeline-version-card-header">
                <div class="version-badge-group">
                  <span class="version-semver-pill">v${escapeHtml(v.version)}</span>
                  ${statePill}
                  ${isActive ? '<span style="font-size:0.75rem; font-weight:700; color:var(--app-purple-accent);">★ Versión Principal</span>' : ''}
                </div>
                <span class="version-date-label">📅 ${escapeHtml(dateStr)} • ${v.total_chapters || 0} capítulos</span>
              </div>

              ${v.changelog ? `
                <div class="version-changelog-card">
                  <strong>Notas de Versión / Changelog:</strong>
                  <div style="margin-top:0.25rem; white-space:pre-line;">${escapeHtml(v.changelog)}</div>
                </div>
              ` : ''}

              <div class="version-card-footer">
                <span class="version-checksum-label" title="${escapeHtml(v.checksum || '')}">SHA-256: ${escapeHtml(shortHash)}</span>
                <div class="version-actions-wrap">
                  ${!isActive ? `<button class="btn-sm-action btn-activate-ver" data-ver-id="${escapeHtml(v.id)}" title="Activar esta versión como principal">Activar</button>` : ''}
                  <button class="btn-sm-action btn-compare-ver" data-ver-version="${escapeHtml(v.version)}" title="Comparar esta versión">Comparar</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Listeners en botones de versiones
        versionsTimelineList.querySelectorAll('.btn-activate-ver').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const verId = btn.getAttribute('data-ver-id');
            await handleActivateVersion(bookId, verId);
          });
        });

        versionsTimelineList.querySelectorAll('.btn-compare-ver').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const ver = btn.getAttribute('data-ver-version');
            closeVersionsModal();
            openCompareModal(bookId, null, ver);
          });
        });
      }
    } catch (err) {
      if (versionsModalAlert) {
        versionsModalAlert.textContent = err.message;
        versionsModalAlert.className = 'alert-message error';
        versionsModalAlert.classList.remove('hidden');
      }
    }
  }

  async function handleActivateVersion(bookId, versionId) {
    try {
      await fetchJsonSafely(`/api/books/${bookId}/activate-version/${versionId}`, { method: 'POST' });
      await loadLibrary();
      await openVersionsModal(bookId);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  bookStateSelector?.addEventListener('change', async () => {
    if (!currentVersionsBookId) return;
    try {
      const newState = bookStateSelector.value;
      await fetchJsonSafely(`/api/books/${currentVersionsBookId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      });

      await loadLibrary();
      await loadVersionsHistory(currentVersionsBookId);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  btnOpenCompareFromVersions?.addEventListener('click', () => {
    if (currentVersionsBookId) {
      const bId = currentVersionsBookId;
      closeVersionsModal();
      openCompareModal(bId);
    }
  });

  btnCloseVersionsModal?.addEventListener('click', closeVersionsModal);
  btnCloseVersionsBtn?.addEventListener('click', closeVersionsModal);
  if (versionsModal) {
    versionsModal.addEventListener('click', (e) => {
      if (e.target === versionsModal) closeVersionsModal();
    });
  }

  // ==========================================
  // MODAL DE COMPARACIÓN ENTRE VERSIONES (DIFF)
  // ==========================================
  async function openCompareModal(bookId, defaultFrom = null, defaultTo = null) {
    if (!compareModal) return;
    currentCompareBookId = bookId;
    compareModal.classList.remove('hidden');
    if (compareModalAlert) compareModalAlert.classList.add('hidden');
    if (compareDiffViewer) compareDiffViewer.classList.add('hidden');

    try {
      const data = await fetchJsonSafely(`/api/books/${bookId}/versions`);
      const versions = data.versions || [];
      if (versions.length < 2) {
        if (compareModalAlert) {
          compareModalAlert.textContent = 'Este libro solo tiene 1 versión registrada. Sube una nueva versión para poder compararlas.';
          compareModalAlert.className = 'alert-message info';
          compareModalAlert.classList.remove('hidden');
        }
      }

      // Rellenar dropdowns
      if (compareVersionA && compareVersionB) {
        compareVersionA.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.version)}">v${escapeHtml(v.version)} (${escapeHtml(v.publication_date ? v.publication_date.substring(0, 10) : '')})</option>`).join('');
        compareVersionB.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.version)}">v${escapeHtml(v.version)} (${escapeHtml(v.publication_date ? v.publication_date.substring(0, 10) : '')})</option>`).join('');

        if (defaultFrom && versions.some(v => v.version === defaultFrom)) {
          compareVersionA.value = defaultFrom;
        } else if (versions.length >= 2) {
          compareVersionA.value = versions[1].version;
        }

        if (defaultTo && versions.some(v => v.version === defaultTo)) {
          compareVersionB.value = defaultTo;
        } else if (versions.length >= 1) {
          compareVersionB.value = versions[0].version;
        }
      }

      await executeComparison(bookId);
    } catch (err) {
      if (compareModalAlert) {
        compareModalAlert.textContent = err.message;
        compareModalAlert.className = 'alert-message error';
        compareModalAlert.classList.remove('hidden');
      }
    }
  }

  function closeCompareModal() {
    if (!compareModal) return;
    compareModal.classList.add('hidden');
    currentCompareBookId = null;
  }

  async function executeComparison(bookId) {
    if (!compareVersionA || !compareVersionB) return;
    const fromVer = compareVersionA.value;
    const toVer = compareVersionB.value;

    if (!fromVer || !toVer) return;

    try {
      const report = await fetchJsonSafely(`/api/books/${bookId}/compare?from=${encodeURIComponent(fromVer)}&to=${encodeURIComponent(toVer)}`);
      renderCompareReport(report);
    } catch (err) {
      if (compareModalAlert) {
        compareModalAlert.textContent = err.message;
        compareModalAlert.className = 'alert-message error';
        compareModalAlert.classList.remove('hidden');
      }
    }
  }

  function renderCompareReport(report) {
    const { comparison, chapters, assets } = report;

    // 1. Badge SemVer
    if (compareSemverBadge) {
      const jump = comparison.semverJump || 'equal';
      compareSemverBadge.className = `metric-value semver-badge ${jump}`;
      compareSemverBadge.textContent = jump.toUpperCase();
    }

    // 2. Desglose Capítulos
    if (compareChaptersBreakdown) {
      const cSum = comparison.summary.chapters;
      compareChaptersBreakdown.innerHTML = `
        <span style="color:#22c55e;">+${cSum.added}</span> / 
        <span style="color:#ef4444;">-${cSum.removed}</span> / 
        <span style="color:#f59e0b;">~${cSum.modified}</span> / 
        <span style="color:#94a3b8;">=${cSum.unchanged}</span>
      `;
    }

    // 3. Diferencial de palabras
    if (compareWordsDelta) {
      const delta = comparison.summary.words.netDelta;
      const sign = delta > 0 ? '+' : '';
      compareWordsDelta.textContent = `${sign}${delta} palabras`;
      compareWordsDelta.style.color = delta > 0 ? '#22c55e' : (delta < 0 ? '#ef4444' : 'var(--app-text-main)');
    }

    // 4. Desglose Assets
    if (compareAssetsBreakdown) {
      const aSum = comparison.summary.assets;
      compareAssetsBreakdown.innerHTML = `
        <span style="color:#22c55e;">+${aSum.added}</span> / 
        <span style="color:#ef4444;">-${aSum.removed}</span> / 
        <span style="color:#f59e0b;">~${aSum.modified}</span>
      `;
    }

    // 5. Tabla de Capítulos
    if (compareChaptersTbody) {
      if (!chapters || chapters.length === 0) {
        compareChaptersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--app-text-muted);">No hay capítulos para comparar.</td></tr>';
      } else {
        compareChaptersTbody.innerHTML = chapters.map((ch, idx) => {
          let pill = '';
          if (ch.status === 'added') pill = '<span class="diff-status-pill added" title="Capítulo añadido en la nueva versión">+</span>';
          else if (ch.status === 'removed') pill = '<span class="diff-status-pill removed" title="Capítulo eliminado en la nueva versión">-</span>';
          else if (ch.status === 'modified') pill = '<span class="diff-status-pill modified" title="Contenido modificado">~</span>';
          else pill = '<span class="diff-status-pill unchanged" title="Sin cambios">=</span>';

          const wordDeltaStr = ch.wordDelta !== 0 ? ` (${ch.wordDelta > 0 ? '+' : ''}${ch.wordDelta})` : '';
          const shortHash = ch.checksumB ? `${ch.checksumB.substring(0, 8)}...` : (ch.checksumA ? `${ch.checksumA.substring(0, 8)}...` : 'N/A');

          const hasDiff = ch.status === 'modified' && ch.diff && ch.diff.length > 0;

          return `
            <tr>
              <td>${pill}</td>
              <td><strong>Cap. ${escapeHtml(ch.chapter_number || ch.order_index)}</strong>: ${escapeHtml(ch.title || '')}</td>
              <td>${ch.wordsB || ch.wordsA || 0}${wordDeltaStr}</td>
              <td class="mono" style="font-size:0.75rem;">${escapeHtml(shortHash)}</td>
              <td>
                ${hasDiff ? `<button class="btn-sm-action btn-view-chapter-diff" data-ch-index="${idx}">Ver Diff</button>` : '<span style="color:var(--app-text-muted); font-size:0.75rem;">--</span>'}
              </td>
            </tr>
          `;
        }).join('');

        compareChaptersTbody.querySelectorAll('.btn-view-chapter-diff').forEach(btn => {
          btn.addEventListener('click', () => {
            const chIndex = parseInt(btn.getAttribute('data-ch-index'), 10);
            const ch = chapters[chIndex];
            if (ch && ch.diff) {
              showLineDiffViewer(`Diferencias: ${ch.title}`, ch.diff);
            }
          });
        });
      }
    }

    // 6. Tabla de Assets
    if (compareAssetsTbody) {
      if (!assets || assets.length === 0) {
        compareAssetsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--app-text-muted);">No hay recursos ni imágenes adjuntos.</td></tr>';
      } else {
        compareAssetsTbody.innerHTML = assets.map(a => {
          let pill = '';
          if (a.status === 'added') pill = '<span class="diff-status-pill added">+</span>';
          else if (a.status === 'removed') pill = '<span class="diff-status-pill removed">-</span>';
          else if (a.status === 'modified') pill = '<span class="diff-status-pill modified">~</span>';
          else pill = '<span class="diff-status-pill unchanged">=</span>';

          const sizeStr = `${Math.round((a.sizeB || a.sizeA || 0) / 1024)} KB`;
          const shortHash = a.checksumB ? `${a.checksumB.substring(0, 8)}...` : (a.checksumA ? `${a.checksumA.substring(0, 8)}...` : 'N/A');

          return `
            <tr>
              <td>${pill}</td>
              <td class="mono">${escapeHtml(a.relativePath || a.filename)}</td>
              <td>${sizeStr}</td>
              <td class="mono" style="font-size:0.75rem;">${escapeHtml(shortHash)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function showLineDiffViewer(title, diffLines) {
    if (!compareDiffViewer || !diffLinesContainer) return;
    if (diffViewerTitle) diffViewerTitle.textContent = title;

    diffLinesContainer.innerHTML = diffLines.map(line => {
      let lineClass = 'diff-unchanged';
      if (line.type === 'added') lineClass = 'diff-added';
      else if (line.type === 'removed') lineClass = 'diff-removed';

      return `<div class="diff-line ${lineClass}">${escapeHtml(line.text)}</div>`;
    }).join('');

    compareDiffViewer.classList.remove('hidden');
    compareDiffViewer.scrollIntoView({ behavior: 'smooth' });
  }

  btnCloseDiff?.addEventListener('click', () => {
    if (compareDiffViewer) compareDiffViewer.classList.add('hidden');
  });

  btnExecuteCompare?.addEventListener('click', () => {
    if (currentCompareBookId) {
      executeComparison(currentCompareBookId);
    }
  });

  btnCloseCompareModal?.addEventListener('click', closeCompareModal);
  btnCloseCompareBtn?.addEventListener('click', closeCompareModal);
  if (compareModal) {
    compareModal.addEventListener('click', (e) => {
      if (e.target === compareModal) closeCompareModal();
    });
  }

  window.openVersionsModal = openVersionsModal;
  window.openCompareModal = openCompareModal;

  function checkHash() {
    const h = window.location.hash;
    if (h === '#books') {
      openPublicationsView('all', 'Libros');
    } else if (h === '#updates') {
      showMainView('updates');
    } else if (h === '#wiki') {
      openWiki();
    }
  }

  // Manejo accesible de tecla Escape para modales y cajones
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (deleteModal && !deleteModal.classList.contains('hidden')) {
        closeDeleteModal();
      } else if (backupModal && !backupModal.classList.contains('hidden')) {
        closeBackupModal();
      } else if (integrityModal && !integrityModal.classList.contains('hidden')) {
        closeIntegrityModal();
      } else if (versionsModal && !versionsModal.classList.contains('hidden')) {
        closeVersionsModal();
      } else if (compareModal && !compareModal.classList.contains('hidden')) {
        closeCompareModal();
      } else if (uploadModal && !uploadModal.classList.contains('hidden')) {
        closeUploadModal();
      } else if (wikiView && !wikiView.classList.contains('hidden')) {
        showMainView('publications');
      } else if (searchDrawer && !searchDrawer.classList.contains('hidden')) {
        searchDrawer.classList.add('hidden');
      }
    }
  });

  window.addEventListener('hashchange', checkHash);

  // Iniciar
  loadLibrary().then(() => {
    checkHash();
  });
});
