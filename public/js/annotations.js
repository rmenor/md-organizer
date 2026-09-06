// Motor de Resaltado y Serialización de Anotaciones
const AnnotationsEngine = (() => {
  const VALID_COLORS = ['yellow', 'green', 'blue', 'pink'];

  function getTextNodes(root) {
    const textNodes = [];
    function walk(node) {
      if (node.nodeType === 3) { // Node.TEXT_NODE
        if (node.nodeValue && node.nodeValue.length > 0) {
          textNodes.push(node);
        }
      } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    }
    walk(root);
    return textNodes;
  }

  function createSelectorFromOffsets(root, startOffset, endOffset, contextLength = 20) {
    const fullText = root.textContent || '';
    const exact = fullText.slice(startOffset, endOffset);
    const prefix = fullText.slice(Math.max(0, startOffset - contextLength), startOffset);
    const suffix = fullText.slice(endOffset, Math.min(fullText.length, endOffset + contextLength));
    return {
      exact,
      prefix,
      suffix,
      startOffset,
      endOffset
    };
  }

  function serializeSelection(root, selection) {
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;

    const textNodes = getTextNodes(root);
    let currentOffset = 0;
    let startOffset = -1;
    let endOffset = -1;

    for (const node of textNodes) {
      const nodeLen = node.nodeValue ? node.nodeValue.length : 0;
      if (node === range.startContainer) {
        startOffset = currentOffset + range.startOffset;
      }
      if (node === range.endContainer) {
        endOffset = currentOffset + range.endOffset;
      }
      currentOffset += nodeLen;
    }

    if (startOffset === -1 || endOffset === -1 || startOffset >= endOffset) {
      return null;
    }

    const exact = (root.textContent || '').slice(startOffset, endOffset).trim();
    if (!exact) return null;

    return createSelectorFromOffsets(root, startOffset, endOffset);
  }

  function resolveOffsets(root, selector) {
    if (!root || !selector) return null;
    const fullText = root.textContent || '';

    // 1. Direct offset match check
    if (typeof selector.startOffset === 'number' && typeof selector.endOffset === 'number') {
      if (fullText.slice(selector.startOffset, selector.endOffset) === selector.exact) {
        return { startOffset: selector.startOffset, endOffset: selector.endOffset };
      }
    }

    // 2. Match with prefix & suffix context
    if (selector.exact && (selector.prefix || selector.suffix)) {
      const pattern = (selector.prefix || '') + selector.exact + (selector.suffix || '');
      const idx = fullText.indexOf(pattern);
      if (idx !== -1) {
        const s = idx + (selector.prefix ? selector.prefix.length : 0);
        return { startOffset: s, endOffset: s + selector.exact.length };
      }
    }

    // 3. Fallback: match exact string
    if (selector.exact) {
      const idx = fullText.indexOf(selector.exact);
      if (idx !== -1) {
        return { startOffset: idx, endOffset: idx + selector.exact.length };
      }
    }

    return null;
  }

  function applyHighlight(root, annotation) {
    if (!root || !annotation) return false;
    const selector = annotation.selector || {
      exact: annotation.text,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset
    };

    const offsets = resolveOffsets(root, selector);
    if (!offsets) return false;

    const targetStart = offsets.startOffset;
    const targetEnd = offsets.endOffset;
    if (targetStart >= targetEnd) return false;

    const color = VALID_COLORS.includes(annotation.color) ? annotation.color : 'yellow';
    const annId = annotation.id || `ann_${Date.now()}`;

    const textNodes = getTextNodes(root);
    let currentOffset = 0;
    const nodesToWrap = [];

    for (const node of textNodes) {
      const nodeLen = node.nodeValue ? node.nodeValue.length : 0;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLen;

      if (nodeEnd > targetStart && nodeStart < targetEnd) {
        // Overlap detected
        const highlightStartInNode = Math.max(0, targetStart - nodeStart);
        const highlightEndInNode = Math.min(nodeLen, targetEnd - nodeStart);
        nodesToWrap.push({
          node,
          start: highlightStartInNode,
          end: highlightEndInNode
        });
      }

      currentOffset += nodeLen;
    }

    if (nodesToWrap.length === 0) return false;

    // Process nodes in reverse order so node splitting doesn't invalidate subsequent indices
    for (let i = nodesToWrap.length - 1; i >= 0; i--) {
      const item = nodesToWrap[i];
      let targetNode = item.node;

      // Split end first if not at node end
      if (item.end < targetNode.nodeValue.length) {
        targetNode.splitText(item.end);
      }

      // Split start if not at node start
      if (item.start > 0) {
        targetNode = targetNode.splitText(item.start);
      }

      // Wrap targetNode in <mark>
      const mark = document.createElement('mark');
      mark.setAttribute('class', `reader-highlight highlight-${color}`);
      mark.setAttribute('data-annotation-id', annId);

      targetNode.replaceWith(mark);
      mark.appendChild(targetNode);
    }

    return true;
  }

  function removeHighlight(root, annotationId) {
    if (!root || !annotationId) return false;
    const selector = `mark[data-annotation-id="${annotationId}"]`;
    const marks = root.querySelectorAll(selector);
    if (marks.length === 0) return false;

    marks.forEach(mark => {
      mark.replaceWith(...mark.childNodes);
    });

    if (typeof root.normalize === 'function') {
      root.normalize();
    }
    return true;
  }

  function applyAllHighlights(root, annotations) {
    if (!root || !Array.isArray(annotations)) return;
    annotations.forEach(ann => applyHighlight(root, ann));
  }

  return {
    VALID_COLORS,
    getTextNodes,
    createSelectorFromOffsets,
    serializeSelection,
    resolveOffsets,
    applyHighlight,
    removeHighlight,
    applyAllHighlights
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationsEngine;
}
if (typeof window !== 'undefined') {
  window.AnnotationsEngine = AnnotationsEngine;
}
