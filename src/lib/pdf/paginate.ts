/**
 * Splits the flowing content of a letterhead document into fixed A4 pages (794 x 1123 px).
 * It runs inside the headless browser, so it is kept as plain script text.
 */
export const PAGINATE_SCRIPT = `(function(doc){
function sizePdfPage(page) {
  page.style.height = "1123px";
  page.style.overflow = "hidden";
  page.style.display = "flex";
  page.style.flexDirection = "column";
  const head = page.querySelector(".doc-head");
  const foot = page.querySelector(".doc-foot");
  const body = page.querySelector(".doc-body, .cover-main");
  if (foot) foot.style.marginTop = "0";
  if (!body) return;
  const used = (head?.offsetHeight || 0) + (foot?.offsetHeight || 0);
  const available = Math.max(1123 - used, 640);
  body.style.flex = "none";
  body.style.height = \`\${available}px\`;
  body.style.maxHeight = \`\${available}px\`;
  body.style.overflow = "hidden";
  body.style.minHeight = "0";
}

function fitAnalysisImages(doc) {
  doc.querySelectorAll(".analysis-shot img").forEach((img) => {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;
    const box = img.closest(".doc-body");
    const style = box ? doc.defaultView.getComputedStyle(box) : null;
    const padX = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
    const padY = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) : 0;
    const maxW = Math.max(240, (box?.clientWidth || 714) - padX);
    const maxH = Math.max(240, (box?.clientHeight || 900) - padY - 28);
    const scale = Math.min(maxW / naturalW, maxH / naturalH);
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));
    img.style.display = "block";
    img.style.width = \`\${width}px\`;
    img.style.height = \`\${height}px\`;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    img.style.objectFit = "fill";
    img.setAttribute("width", String(width));
    img.setAttribute("height", String(height));
  });
}

function paginateDocument(doc) {
  const flowPage = doc.querySelector(".pdf-content");
  const flow = flowPage?.querySelector(".pdf-flow");
  if (!flowPage || !flow) return;
  doc.querySelectorAll(".pdf-page").forEach(sizePdfPage);
  fitAnalysisImages(doc);
  const blocks = [...flow.children];
  flow.replaceChildren();

  let page = flowPage;
  const boxOf = (target) => target.querySelector(".doc-body");
  const flowOf = (target) => target.querySelector(".pdf-flow");
  const roomFor = (target) => {
    const box = boxOf(target);
    const flow = flowOf(target);
    const style = target.ownerDocument.defaultView.getComputedStyle(box);
    const pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    return box.clientHeight - pad - flow.offsetHeight;
  };
  const overflows = (target) => roomFor(target) < -2;
  const freshPage = () => {
    const clone = flowPage.cloneNode(true);
    clone.querySelector(".pdf-flow").replaceChildren();
    flowPage.parentNode.append(clone);
    sizePdfPage(clone);
    return clone;
  };
  const splitRows = (block, target, childName) => {
    const items = childName === "tbody" ? [...(block.tBodies[0]?.rows || [])] : [...block.children];
    const build = () => {
      const next = block.cloneNode(false);
      next.className = block.className;
      if (childName === "tbody" && block.tHead) next.append(block.tHead.cloneNode(true));
      if (childName === "tbody") next.append(doc.createElement("tbody"));
      return next;
    };
    let current = build();
    const host = () => (childName === "tbody" ? current.tBodies[0] : current);
    const flow = () => flowOf(target);
    if (flow().children.length) {
      flow().append(current);
      if (overflows(target)) {
        flow().removeChild(current);
        target = freshPage();
        current = build();
      }
    }
    flowOf(target).append(current);
    items.forEach((item) => {
      host().append(item);
      if (!overflows(target)) return;
      host().removeChild(item);
      const siblings = [...flowOf(target).children].filter((node) => node !== current);
      if (!host().children.length && siblings.length) flowOf(target).removeChild(current);
      else if (!host().children.length) {
        host().append(item);
        return;
      }
      target = freshPage();
      current = build();
      flowOf(target).append(current);
      host().append(item);
    });
    return target;
  };

  function place(block, target) {
    if (block.classList?.contains("pdf-break")) {
      if (flowOf(target).children.length) target = freshPage();
      [...block.children].forEach((child) => {
        target = place(child, target);
      });
      return target;
    }
    const flow = flowOf(target);
    flow.append(block);
    if (!overflows(target)) {
      if (/^H[1-3]$/.test(block.tagName) && roomFor(target) < 96 && flow.children.length > 1) {
        flow.removeChild(block);
        target = freshPage();
        flowOf(target).append(block);
      }
      return target;
    }
    flow.removeChild(block);
    if (block.tagName === "TABLE") {
      if (flowOf(target).children.length) target = freshPage();
      return splitRows(block, target, "tbody");
    }
    if (block.tagName === "UL" || block.tagName === "OL") {
      if (flowOf(target).children.length) target = freshPage();
      return splitRows(block, target, "list");
    }
    const atomic = block.classList?.contains("pdf-keep")
      || block.classList?.contains("metrics")
      || block.classList?.contains("card")
      || block.classList?.contains("analysis-shot");
    const kids = [...block.children];
    if (!atomic && kids.length && /^(SECTION|DIV|ARTICLE)$/.test(block.tagName)) {
      kids.forEach((kid) => {
        target = place(kid, target);
      });
      return target;
    }
    if (flowOf(target).children.length) target = freshPage();
    flowOf(target).append(block);
    return target;
  }

  blocks.forEach((block) => {
    page = place(block, page);
  });
  [...doc.querySelectorAll(".pdf-page")].forEach((item, index) => {
    item.querySelectorAll(".doc-page").forEach((label) => {
      label.textContent = String(index + 1);
    });
  });
}


  paginateDocument(doc);
  return doc.querySelectorAll('.pdf-page').length;
})(document)`;
