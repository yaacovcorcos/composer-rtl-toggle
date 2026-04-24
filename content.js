(function () {
  "use strict";

  const HOST_SLOT_ATTR = "data-rtl-composer-slot";
  const STORAGE_PREFIX = "rtl-composer-direction:";
  const VISIBLE_BLOCK_SELECTOR = [
    "p",
    "div",
    "li",
    "blockquote",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6"
  ].join(",");

  const state = {
    directionBySite: new Map(),
    controllers: new WeakMap(),
    scanQueued: false
  };

  const storage = createStorage();

  async function bootstrap() {
    state.directionBySite.set(site.id, await loadDirection(site.id));
    scan();

    const observer = new MutationObserver(() => {
      queueScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener("pageshow", queueScan, true);
    window.addEventListener("resize", queueScan, { passive: true });
    document.addEventListener("focusin", queueScan, true);
  }

  function queueScan() {
    if (state.scanQueued) {
      return;
    }

    state.scanQueued = true;
    requestAnimationFrame(() => {
      state.scanQueued = false;
      scan();
    });
  }

  function scan() {
    const editors = site.locateEditors();

    editors.forEach((editor) => {
      if (!(editor instanceof HTMLElement) || !isVisible(editor)) {
        return;
      }

      const existing = state.controllers.get(editor);
      if (existing) {
        ensureMounted(existing);
        applyDirection(existing, existing.direction);
        return;
      }

      const composerRoot = site.findComposerRoot(editor);
      if (!composerRoot) {
        return;
      }

      const anchor = site.findAnchor(editor, composerRoot);
      if (!anchor) {
        return;
      }

      const mountPlan = buildMountPlan(anchor, composerRoot, editor);
      const controller = createController({
        siteId: site.id,
        editor,
        composerRoot,
        anchor,
        mountPlan,
        direction: getDirection(site.id)
      });

      state.controllers.set(editor, controller);
      mountController(controller);
      applyDirection(controller, controller.direction);
    });
  }

  function createController({ siteId, editor, composerRoot, anchor, mountPlan, direction }) {
    const slot = document.createElement("span");
    slot.className = "rtl-composer-toggle-slot";
    slot.setAttribute(HOST_SLOT_ATTR, siteId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "rtl-composer-toggle-button";

    const glyph = document.createElement("span");
    glyph.className = "rtl-composer-toggle-glyph";
    glyph.setAttribute("aria-hidden", "true");

    ["top", "middle", "bottom"].forEach((name) => {
      const line = document.createElement("span");
      line.className = "rtl-composer-toggle-line";
      line.dataset.line = name;
      glyph.appendChild(line);
    });

    button.appendChild(glyph);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      controller.direction = controller.direction === "rtl" ? "ltr" : "rtl";
      state.directionBySite.set(siteId, controller.direction);
      await saveDirection(siteId, controller.direction);
      applyDirection(controller, controller.direction);
    });

    slot.appendChild(button);

    const syncBlocks = () => {
      if (controller.direction === "rtl") {
        normalizeBlocks(controller.editor, "rtl");
      } else {
        normalizeBlocks(controller.editor, "ltr");
      }
    };

    editor.addEventListener("input", syncBlocks, true);
    editor.addEventListener("keyup", syncBlocks, true);
    editor.addEventListener("paste", () => {
      setTimeout(syncBlocks, 0);
    }, true);

    const controller = {
      siteId,
      editor,
      composerRoot,
      anchor,
      mountPlan,
      slot,
      button,
      direction
    };

    return controller;
  }

  function mountController(controller) {
    const parent = controller.mountPlan?.parent;
    const after = controller.mountPlan?.after;

    if (!(parent instanceof HTMLElement)) {
      return;
    }

    if (controller.slot.parentElement !== parent) {
      controller.slot.remove();
    }

    if (!(after instanceof HTMLElement) || after.parentElement !== parent) {
      if (!controller.slot.isConnected) {
        parent.appendChild(controller.slot);
      } else if (controller.slot.parentElement !== parent) {
        parent.appendChild(controller.slot);
      }
      return;
    }

    const nextSibling = after.nextElementSibling;
    if (!controller.slot.isConnected) {
      after.insertAdjacentElement("afterend", controller.slot);
      return;
    }

    if (controller.slot.parentElement !== parent || nextSibling !== controller.slot) {
      after.insertAdjacentElement("afterend", controller.slot);
    }
  }

  function ensureMounted(controller) {
    if (!document.contains(controller.editor)) {
      return;
    }

    const root = site.findComposerRoot(controller.editor);
    const anchor = site.findAnchor(controller.editor, root || controller.composerRoot);
    const mountPlan = anchor ? buildMountPlan(anchor, root || controller.composerRoot, controller.editor) : null;

    if (!root || !anchor || !mountPlan?.parent) {
      return;
    }

    controller.composerRoot = root;
    controller.anchor = anchor;
    controller.mountPlan = mountPlan;
    mountController(controller);
  }

  function applyDirection(controller, direction) {
    const { button, editor } = controller;
    const isRtl = direction === "rtl";

    syncButtonVisualStyle(controller);
    button.dataset.direction = direction;
    button.setAttribute("aria-pressed", String(isRtl));
    button.setAttribute(
      "aria-label",
      isRtl ? "Composer direction set to right to left" : "Composer direction set to left to right"
    );
    button.title = isRtl ? "Switch composer to LTR" : "Switch composer to RTL";

    editor.dataset.rtlComposerEditor = "true";
    editor.setAttribute("dir", direction);
    editor.style.direction = direction;
    editor.style.textAlign = isRtl ? "right" : "left";

    const wrappers = collectDirectionWrappers(editor);
    wrappers.forEach((node) => {
      node.setAttribute("dir", direction);
      node.style.direction = direction;
      node.style.textAlign = isRtl ? "right" : "left";
    });

    normalizeBlocks(editor, direction);
  }

  function syncButtonVisualStyle(controller) {
    const sampled = sampleAnchorVisualStyle(controller.anchor);
    if (!sampled) {
      controller.button.style.removeProperty("--rtl-toggle-color");
      controller.button.style.removeProperty("--rtl-toggle-opacity");
      return;
    }

    controller.button.style.setProperty("--rtl-toggle-color", sampled.color);
    controller.button.style.setProperty("--rtl-toggle-opacity", sampled.opacity);
  }

  function sampleAnchorVisualStyle(anchor) {
    if (!(anchor instanceof HTMLElement)) {
      return null;
    }

    const icon = anchor.querySelector("svg, mat-icon, .icon, [class*='icon'], use");
    const source = icon instanceof SVGElement || icon instanceof HTMLElement ? icon : anchor;
    const styles = getComputedStyle(source);
    const fallbackStyles = getComputedStyle(anchor);

    const color = lightenColor(
      normalizeColor(styles.color) || normalizeColor(fallbackStyles.color),
      0.34
    );
    const opacity = normalizeOpacity(styles.opacity) || normalizeOpacity(fallbackStyles.opacity) || "1";

    if (!color) {
      return null;
    }

    return { color, opacity };
  }

  function normalizeColor(color) {
    if (!color || color === "rgba(0, 0, 0, 0)" || color === "transparent") {
      return "";
    }

    return color;
  }

  function lightenColor(color, amount) {
    if (!color) {
      return "";
    }

    const match = color.match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return color;
    }

    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length < 3) {
      return color;
    }

    const [r, g, b] = parts.slice(0, 3).map((value) => Number.parseFloat(value));
    const alpha = parts[3] ? Number.parseFloat(parts[3]) : null;
    const mix = (channel) => Math.round(channel + ((255 - channel) * amount));

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return color;
    }

    if (alpha === null || Number.isNaN(alpha)) {
      return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    }

    return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
  }

  function normalizeOpacity(opacity) {
    if (!opacity || opacity === "NaN") {
      return "";
    }

    return opacity;
  }

  function collectDirectionWrappers(editor) {
    const nodes = [editor];
    const richTextarea = editor.closest("rich-textarea");
    const proseContainer = editor.closest("[data-testid*='composer'], [class*='textarea'], [class*='editor']");

    if (richTextarea instanceof HTMLElement) {
      nodes.push(richTextarea);
    }

    if (proseContainer instanceof HTMLElement && proseContainer !== editor) {
      nodes.push(proseContainer);
    }

    return nodes;
  }

  function normalizeBlocks(editor, direction) {
    if (editor instanceof HTMLTextAreaElement) {
      return;
    }

    const textAlign = direction === "rtl" ? "right" : "left";
    const children = Array.from(editor.querySelectorAll(`:scope > ${VISIBLE_BLOCK_SELECTOR}`));

    children.forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }

      child.setAttribute("dir", direction);
      child.style.textAlign = textAlign;
    });

    const selection = document.getSelection();
    const anchorNode = selection?.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) {
      return;
    }

    const currentBlock = closestElement(anchorNode, editor, VISIBLE_BLOCK_SELECTOR);
    if (currentBlock) {
      currentBlock.setAttribute("dir", direction);
      currentBlock.style.textAlign = textAlign;
    }
  }

  function loadDirection(siteId) {
    return storage.get(STORAGE_PREFIX + siteId).then((value) => value === "rtl" ? "rtl" : "ltr");
  }

  function saveDirection(siteId, direction) {
    return storage.set({ [STORAGE_PREFIX + siteId]: direction });
  }

  function getDirection(siteId) {
    return state.directionBySite.get(siteId) || "ltr";
  }

  function detectSite() {
    const hostname = window.location.hostname;

    if (hostname === "chatgpt.com" || hostname === "chat.openai.com") {
      return SITE_DEFINITIONS.chatgpt;
    }

    if (hostname === "gemini.google.com") {
      return SITE_DEFINITIONS.gemini;
    }

    if (hostname === "claude.ai") {
      return SITE_DEFINITIONS.claude;
    }

    return null;
  }

  function createStorage() {
    return {
      get(key) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
          });
        });
      },
      set(value) {
        return new Promise((resolve) => {
          chrome.storage.local.set(value, resolve);
        });
      }
    };
  }

  function locateEditorsBySelectors(selectors) {
    const matches = [];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (node instanceof HTMLElement) {
          matches.push(node);
        }
      });
    });

    return dedupe(matches).filter(isEditableCandidate);
  }

  function isEditableCandidate(node) {
    if (!(node instanceof HTMLElement) || !isVisible(node)) {
      return false;
    }

    if (node.closest("[data-rtl-composer-slot]")) {
      return false;
    }

    const label = getElementLabel(node);
    return Boolean(
      node instanceof HTMLTextAreaElement ||
      node.getAttribute("contenteditable") === "true" ||
      /prompt|message|claude|gemini|chat/i.test(label)
    );
  }

  function findComposerRoot(editor) {
    return (
      editor.closest("form") ||
      editor.closest("fieldset") ||
      editor.closest("[data-testid*='composer']") ||
      editor.closest("[data-node-type='input-area']") ||
      editor.closest("main") ||
      editor.parentElement
    );
  }

  function findFirstVisible(root, selectors) {
    if (!(root instanceof HTMLElement)) {
      return null;
    }

    for (const selector of selectors) {
      const match = root.querySelector(selector);
      if (match instanceof HTMLElement && isVisible(match)) {
        return match;
      }
    }

    return null;
  }

  function findAnchorByPatterns(root, patterns) {
    if (!(root instanceof HTMLElement)) {
      return null;
    }

    const buttons = Array.from(root.querySelectorAll("button, [role='button']"))
      .filter((node) => node instanceof HTMLElement)
      .filter(isNativeComposerControl)
      .filter(isVisible);

    let bestMatch = null;
    let bestScore = -1;

    buttons.forEach((button) => {
      const label = getElementLabel(button);
      const dataHint = [
        label,
        button.getAttribute("data-testid"),
        button.getAttribute("title"),
        button.className
      ].join(" ");

      let score = 0;

      patterns.forEach((pattern, index) => {
        if (pattern.test(dataHint)) {
          score += 30 - index;
        }
      });

      if (score === 0) {
        return;
      }

      const rect = button.getBoundingClientRect();
      score += rect.width < 160 ? 3 : 0;
      score += rect.height < 64 ? 3 : 0;

      if (score > bestScore) {
        bestMatch = button;
        bestScore = score;
      }
    });

    return bestMatch;
  }

  function findLeadingVisibleButton(root, editor) {
    if (!(root instanceof HTMLElement) || !(editor instanceof HTMLElement)) {
      return null;
    }

    const editorRect = editor.getBoundingClientRect();
    const editorMidY = editorRect.top + (editorRect.height / 2);
    const editorLeft = editorRect.left;

    const buttons = Array.from(root.querySelectorAll("button, [role='button']"))
      .filter((node) => node instanceof HTMLElement)
      .filter(isNativeComposerControl)
      .filter(isVisible)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        let score = 0;

        if (rect.left <= editorLeft + 80) {
          score += 8;
        }

        if (Math.abs(rect.top - editorRect.bottom) < 120) {
          score += 6;
        }

        if (Math.abs((rect.top + (rect.height / 2)) - editorMidY) < 90) {
          score += 3;
        }

        if (rect.width <= 56) {
          score += 3;
        }

        return { button, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return buttons[0]?.button || null;
  }

  function isNativeComposerControl(element) {
    return element instanceof HTMLElement && !element.closest(`[${HOST_SLOT_ATTR}]`);
  }

  function resolveMountTarget(anchor, root) {
    if (!(anchor instanceof HTMLElement)) {
      return null;
    }

    let node = anchor;
    let depth = 0;

    while (node.parentElement && node !== root && depth < 5) {
      const parent = node.parentElement;
      const parentStyle = getComputedStyle(parent);
      const children = Array.from(parent.children);
      const isLayoutParent = parentStyle.display.includes("flex") || parentStyle.display.includes("grid");

      if (isLayoutParent && children.length > 1) {
        return node;
      }

      if (children.length <= 3 && parent.parentElement) {
        const grandParent = parent.parentElement;
        const grandStyle = getComputedStyle(grandParent);
        const grandChildren = Array.from(grandParent.children);
        const isGrandLayout = grandStyle.display.includes("flex") || grandStyle.display.includes("grid");

        if (isGrandLayout && grandChildren.length > 1) {
          return parent;
        }
      }

      node = parent;
      depth += 1;
    }

    return anchor;
  }

  function buildDefaultMountPlan(anchor, root) {
    const mountTarget = resolveMountTarget(anchor, root) || anchor;
    return {
      parent: mountTarget?.parentElement || null,
      after: mountTarget || null
    };
  }

  function buildMountPlan(anchor, root, editor) {
    if (typeof site.buildMountPlan === "function") {
      const customPlan = site.buildMountPlan(anchor, root, editor);
      if (customPlan?.parent) {
        return customPlan;
      }
    }

    return buildDefaultMountPlan(anchor, root);
  }

  function findAncestorByGridArea(element, gridArea, stopAt) {
    let node = element;

    while (node && node !== stopAt) {
      if (node instanceof HTMLElement && getComputedStyle(node).gridArea === gridArea) {
        return node;
      }
      node = node.parentElement;
    }

    if (stopAt instanceof HTMLElement && getComputedStyle(stopAt).gridArea === gridArea) {
      return stopAt;
    }

    return null;
  }

  function findFlexAncestor(element, stopAt) {
    let node = element.parentElement;

    while (node && node !== stopAt) {
      if (getComputedStyle(node).display.includes("flex")) {
        return node;
      }
      node = node.parentElement;
    }

    return null;
  }

  function getElementLabel(element) {
    if (!(element instanceof HTMLElement)) {
      return "";
    }

    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("placeholder"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0 &&
      element.getClientRects().length > 0
    );
  }

  function dedupe(items) {
    return Array.from(new Set(items));
  }

  function closestElement(node, stopAt, selector) {
    let current = node instanceof HTMLElement ? node : node.parentElement;

    while (current && current !== stopAt) {
      if (current.matches?.(selector)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  const SITE_DEFINITIONS = {
    chatgpt: {
      id: "chatgpt",
      locateEditors() {
        return locateEditorsBySelectors([
          "#prompt-textarea",
          "[data-testid='prompt-textarea']",
          "textarea[aria-label='Chat with ChatGPT']",
          "form textarea[aria-label*='ChatGPT']",
          "form textarea[placeholder*='Message']",
          "form textarea[aria-label*='Message']",
          "[data-testid*='composer'] textarea",
          "[data-testid*='composer'] [contenteditable='true']"
        ]);
      },
      findComposerRoot(editor) {
        const root =
          editor.closest("form") ||
          editor.closest("[data-testid*='composer']");

        if (!(root instanceof HTMLElement)) {
          return null;
        }

        const hasComposerControl = Boolean(
          findFirstVisible(root, [
            "#composer-plus-btn",
            "[data-testid='composer-plus-btn']",
            "button[aria-label='Add files and more']"
          ]) ||
          findAnchorByPatterns(root, [/\btool/i]) ||
          findLeadingVisibleButton(root, editor)
        );

        return hasComposerControl ? root : null;
      },
      findAnchor(editor, root) {
        return (
          findFirstVisible(root, [
            "#composer-plus-btn",
            "[data-testid='composer-plus-btn']",
            "button[aria-label='Add files and more']"
          ]) ||
          findAnchorByPatterns(root, [/\btool/i]) ||
          findLeadingVisibleButton(root, editor) ||
          null
        );
      },
      buildMountPlan(anchor, root) {
        const leadingArea = findAncestorByGridArea(anchor, "leading", root);
        if (leadingArea instanceof HTMLElement) {
          const flexRow = findFlexAncestor(anchor, leadingArea);
          if (flexRow instanceof HTMLElement) {
            return {
              parent: flexRow,
              after: anchor
            };
          }
        }

        return buildDefaultMountPlan(anchor, root);
      }
    },
    gemini: {
      id: "gemini",
      locateEditors() {
        return locateEditorsBySelectors([
          ".ql-editor[aria-label='Enter a prompt for Gemini']",
          ".ql-editor[aria-label*='Gemini']",
          "rich-textarea .ql-editor[role='textbox']"
        ]);
      },
      findComposerRoot(editor) {
        return (
          editor.closest("input-area-v2") ||
          editor.closest("input-container") ||
          editor.closest("[data-node-type='input-area']") ||
          editor.closest("fieldset") ||
          findComposerRoot(editor)
        );
      },
      findAnchor(editor, root) {
        return (
          findFirstVisible(root, [
            "button[aria-label='Open upload file menu']",
            "button[aria-label='Tools']"
          ]) ||
          findAnchorByPatterns(root, [
            /^tools$/i,
            /\btools\b/i,
            /\bopen upload file menu\b/i
          ]) ||
          findLeadingVisibleButton(root, editor) ||
          null
        );
      }
    },
    claude: {
      id: "claude",
      locateEditors() {
        return locateEditorsBySelectors([
          "textarea[placeholder*='Claude']",
          "textarea[aria-label*='Claude']",
          "[contenteditable='true'][aria-label*='Claude']",
          "[contenteditable='true'][data-testid*='input']",
          "form [contenteditable='true']",
          "form textarea"
        ]);
      },
      findComposerRoot(editor) {
        return (
          editor.closest("form") ||
          editor.closest("fieldset") ||
          editor.closest("[data-testid*='composer']") ||
          editor.closest("[data-testid*='input']") ||
          findComposerRoot(editor)
        );
      },
      findAnchor(editor, root) {
        return (
          findAnchorByPatterns(root, [
            /\battach\b/i,
            /\bplus\b/i,
            /\badd\b/i,
            /\bupload\b/i,
            /\btool\b/i
          ]) ||
          findLeadingVisibleButton(root, editor) ||
          null
        );
      }
    }
  };

  const site = detectSite();

  if (!site) {
    return;
  }

  bootstrap().catch((error) => {
    console.error("[rtl-composer]", error);
  });
})();
