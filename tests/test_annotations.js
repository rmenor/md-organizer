const test = require('node:test');
const assert = require('node:assert/strict');

// Implement a minimal DOM mock for testing annotation text range matching and DOM manipulation in Node
class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.childNodes = [];
    this.parentNode = null;
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(newNode, refNode) {
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) return this.appendChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 0, newNode);
    return newNode;
  }

  replaceWith(...newNodes) {
    if (!this.parentNode) return;
    const parent = this.parentNode;
    const idx = parent.childNodes.indexOf(this);
    if (idx === -1) return;
    parent.childNodes.splice(idx, 1);
    this.parentNode = null;

    for (let i = newNodes.length - 1; i >= 0; i--) {
      const n = newNodes[i];
      if (n.parentNode) n.parentNode.removeChild(n);
      n.parentNode = parent;
      parent.childNodes.splice(idx, 0, n);
    }
  }

  get textContent() {
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.childNodes = [];
    if (val) {
      this.appendChild(new MockTextNode(val));
    }
  }

  normalize() {
    for (let i = 0; i < this.childNodes.length; i++) {
      const child = this.childNodes[i];
      if (child.nodeType === 3) {
        if (child.nodeValue.length === 0) {
          this.removeChild(child);
          i--;
        } else if (i + 1 < this.childNodes.length && this.childNodes[i + 1].nodeType === 3) {
          child.nodeValue += this.childNodes[i + 1].nodeValue;
          this.removeChild(this.childNodes[i + 1]);
          i--;
        }
      } else if (child.nodeType === 1) {
        child.normalize();
      }
    }
  }
}

class MockTextNode extends MockNode {
  constructor(text = '') {
    super(3, '#text');
    this.nodeValue = String(text);
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(val) {
    this.nodeValue = String(val);
  }

  splitText(offset) {
    const full = this.nodeValue;
    this.nodeValue = full.slice(0, offset);
    const right = new MockTextNode(full.slice(offset));
    if (this.parentNode) {
      const idx = this.parentNode.childNodes.indexOf(this);
      right.parentNode = this.parentNode;
      this.parentNode.childNodes.splice(idx + 1, 0, right);
    }
    return right;
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = {
      _classes: new Set(),
      add(...classes) { classes.forEach(c => this._classes.add(c)); },
      remove(...classes) { classes.forEach(c => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); },
      toString() { return Array.from(this._classes).join(' '); }
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') {
      this.classList._classes = new Set(value.split(/\s+/).filter(Boolean));
    }
  }

  getAttribute(name) {
    if (name === 'class') return this.classList.toString();
    return this.attributes.get(name) || null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  get className() {
    return this.classList.toString();
  }

  set className(val) {
    this.setAttribute('class', val);
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (node) => {
      if (node.nodeType === 1) {
        if (matchesSelector(node, selector)) {
          results.push(node);
        }
        node.childNodes.forEach(traverse);
      }
    };
    this.childNodes.forEach(traverse);
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

function matchesSelector(el, sel) {
  // Simple attribute and class matching
  if (sel.startsWith('mark[data-annotation-id="') && sel.endsWith('"]')) {
    const id = sel.slice('mark[data-annotation-id="'.length, -2);
    return el.tagName === 'MARK' && el.getAttribute('data-annotation-id') === id;
  }
  if (sel === 'mark.reader-highlight' || sel === '.reader-highlight') {
    return el.tagName === 'MARK' && el.classList.contains('reader-highlight');
  }
  return false;
}

// Minimal document mock
global.document = {
  createElement(tag) {
    return new MockElement(tag);
  },
  createTextNode(text) {
    return new MockTextNode(text);
  }
};
global.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3
};

const AnnotationsEngine = require('../public/js/annotations');

test('AnnotationsEngine - Serialization & Range Finding', async (t) => {
  await t.test('serializa la selección con texto exacto, prefijo, sufijo y offsets absolutos', () => {
    const root = new MockElement('div');
    const p = new MockElement('p');
    p.appendChild(new MockTextNode('Clean code does '));
    const strong = new MockElement('strong');
    strong.appendChild(new MockTextNode('one thing'));
    p.appendChild(strong);
    p.appendChild(new MockTextNode(' well and clearly.'));
    root.appendChild(p);

    // root text: "Clean code does one thing well and clearly."
    // select "one thing well"
    // start is offset 16, end is offset 30
    const selector = AnnotationsEngine.createSelectorFromOffsets(root, 16, 30);

    assert.equal(selector.exact, 'one thing well');
    assert.equal(selector.prefix, 'Clean code does ');
    assert.equal(selector.suffix, ' and clearly.');
    assert.equal(selector.startOffset, 16);
    assert.equal(selector.endOffset, 30);
  });
});

test('AnnotationsEngine - Highlight Injection across Mixed Nodes', async (t) => {
  await t.test('envuelve nodos de texto mixtos en etiquetas <mark> con clase y dataset', () => {
    const root = new MockElement('div');
    const p = new MockElement('p');
    p.appendChild(new MockTextNode('Clean code does '));
    const strong = new MockElement('strong');
    strong.appendChild(new MockTextNode('one thing'));
    p.appendChild(strong);
    p.appendChild(new MockTextNode(' well.'));
    root.appendChild(p);

    const annotation = {
      id: 'ann_test_1',
      bookId: 1,
      chapterIndex: 0,
      chapterId: 10,
      text: 'one thing well',
      note: 'Principle 1',
      color: 'yellow',
      selector: {
        exact: 'one thing well',
        prefix: 'Clean code does ',
        suffix: '.',
        startOffset: 16,
        endOffset: 30
      }
    };

    const applied = AnnotationsEngine.applyHighlight(root, annotation);
    assert.equal(applied, true);

    // Debe haber marks inyectados
    const marks = root.querySelectorAll('mark.reader-highlight');
    assert.ok(marks.length >= 1);
    marks.forEach(m => {
      assert.equal(m.getAttribute('data-annotation-id'), 'ann_test_1');
      assert.ok(m.classList.contains('highlight-yellow'));
    });

    // El contenido de texto total no debe alterarse
    assert.equal(root.textContent, 'Clean code does one thing well.');
  });

  await t.test('soporta colores yellow, green, blue, pink', () => {
    const colors = ['yellow', 'green', 'blue', 'pink'];
    for (const color of colors) {
      const root = new MockElement('div');
      root.appendChild(new MockTextNode('Texto de prueba resaltado'));
      const ann = {
        id: `ann_${color}`,
        text: 'prueba',
        color: color,
        selector: {
          exact: 'prueba',
          prefix: 'Texto de ',
          suffix: ' resaltado',
          startOffset: 9,
          endOffset: 15
        }
      };
      AnnotationsEngine.applyHighlight(root, ann);
      const mark = root.querySelector(`mark[data-annotation-id="ann_${color}"]`);
      assert.ok(mark);
      assert.ok(mark.classList.contains(`highlight-${color}`));
    }
  });
});

test('AnnotationsEngine - Unwrap and Cleanup on Deletion', async (t) => {
  await t.test('desenvuelve las etiquetas <mark> y unifica los nodos de texto mediante normalize()', () => {
    const root = new MockElement('div');
    const p = new MockElement('p');
    p.appendChild(new MockTextNode('Los nombres deben revelar su intención claramente.'));
    root.appendChild(p);

    const originalText = root.textContent;

    const ann = {
      id: 'ann_delete_test',
      text: 'revelar su intención',
      color: 'green',
      selector: {
        exact: 'revelar su intención',
        prefix: 'Los nombres deben ',
        suffix: ' claramente.',
        startOffset: 18,
        endOffset: 38
      }
    };

    AnnotationsEngine.applyHighlight(root, ann);
    assert.ok(root.querySelectorAll('mark.reader-highlight').length > 0);

    // Eliminar highlight
    AnnotationsEngine.removeHighlight(root, 'ann_delete_test');
    assert.equal(root.querySelectorAll('mark.reader-highlight').length, 0);

    // Texto debe ser idéntico
    assert.equal(root.textContent, originalText);
  });
});
