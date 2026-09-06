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
      card.title = `${book.title}`;

      const coverClass = coverPalette[index % coverPalette.length];
      const hasRealCover = Boolean(book.cover_image);
      const coverImgSrc = hasRealCover 
        ? `/api/books/${book.id}/assets/${encodeURIComponent(book.cover_image.replace(/^assets\//, ''))}`
        : '';

      // Progreso de lectura guardado en localStorage
      const bookProgress = (typeof Reader !== 'undefined' && Reader.getProgress) ? Reader.getProgress(book.id) : null;
      const progressBadge = bookProgress && (bookProgress.chapterIndex > 0 || bookProgress.scrollTop > 80)
        ? `<span class="book-progress-badge" title="Progreso: Capítulo ${bookProgress.chapterIndex + 1}">Cap. ${bookProgress.chapterIndex + 1}</span>`
        : '';

      card.innerHTML = `
        <div class="book-cover-wrap ${coverClass}">
          ${hasRealCover ? `<img src="${coverImgSrc}" alt="${book.title}" class="book-real-cover" onerror="this.remove()">` : ''}
          <div class="book-cover-inner">
            <span class="book-cover-title-emboss">${book.title}</span>
          </div>
          ${progressBadge}
          <button class="btn-book-delete" data-book-id="${book.id}" title="Eliminar publicación">✕</button>
        </div>
        <div class="book-title-label">${book.title}</div>
      `;

      card.querySelector('.btn-book-delete').addEventListener('click', (e) => {
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
      item.innerHTML = `
        <div class="update-book-info">
          <h4>${book.title}</h4>
          <div class="update-book-meta">
            <span>Código: <strong>${book.code}</strong></span> · 
            <span>Versión: <strong>v${book.version}</strong></span> · 
            <span>Fecha: <strong>${book.publication_date ? book.publication_date.substring(0, 10) : 'N/A'}</strong></span>
          </div>
        </div>
        <div class="update-status-pill">✓ Instalado</div>
      `;
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

  wikiTabChips.forEach(chip => {
    chip.addEventListener('click', () => {
      wikiTabChips.forEach(c => c.classList.remove('active'));
      wikiPanes.forEach(p => p.classList.add('hidden'));

      chip.classList.add('active');
      const target = chip.getAttribute('data-wiki-tab');
      const pane = document.getElementById(`pane-${target}`);
      if (pane) pane.classList.remove('hidden');
    });
  });

  btnCopyTemplate.addEventListener('click', () => {
    navigator.clipboard.writeText(jsonTemplateCode.textContent).then(() => {
      const origText = btnCopyTemplate.textContent;
      btnCopyTemplate.textContent = '✓ ¡Copiado!';
      setTimeout(() => { btnCopyTemplate.textContent = origText; }, 2000);
    });
  });

  async function loadWikiDoc() {
    if (wikiMarkdownContainer.innerHTML.trim().length > 20) return;
    try {
      const res = await fetch('/api/wiki');
      if (res.ok) {
        const data = await res.json();
        wikiMarkdownContainer.innerHTML = marked.parse(data.content);
        return;
      }
      const resFallback = await fetch('/WIKI_COMO_HACER_LIBROS.md');
      if (!resFallback.ok) throw new Error();
      const md = await resFallback.text();
      wikiMarkdownContainer.innerHTML = marked.parse(md);
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
