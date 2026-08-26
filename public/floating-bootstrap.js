(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var config = {
    frontendUrl: String(script.dataset.frontendUrl || ""),
    assetBase: String(script.dataset.assetBase || ""),
    vendorBase: String(script.dataset.vendorBase || ""),
    bridgeKey: String(script.dataset.bridgeKey || ""),
    singletonKey: String(script.dataset.singletonKey || "__ST_HYPNOOS_FLOATING_SINGLETON__"),
    hostId: String(script.dataset.hostId || "hypnoos-floating-phone-host"),
    registryEvent: String(script.dataset.registryEvent || "HYPNOOS_FLOATING_REGISTRY_READY"),
    storageKey: String(script.dataset.storageKey || "hypnoos.floatingPhone.ui.v1"),
    revision: String(script.dataset.revision || "local"),
    mode: String(script.dataset.mode || "stage"),
  };
  var token = "hypnoos-owner-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  function textId(value) {
    if (value === null || value === undefined) return "";
    var text = String(value).trim();
    return text === "undefined" || text === "null" ? "" : text;
  }

  function candidateWindows() {
    var list = [];
    [window, window.parent, window.top].forEach(function (view) {
      try {
        if (view && list.indexOf(view) < 0) list.push(view);
      } catch (_) {}
    });
    return list;
  }

  function messageIdFromWindow() {
    try {
      if (typeof window.getCurrentMessageId === "function") {
        var own = textId(window.getCurrentMessageId());
        if (own) return own;
      }
    } catch (_) {}
    try {
      var frameNode = window.frameElement;
      var messageNode = frameNode && frameNode.closest ? frameNode.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (messageNode) {
        var frameId = textId(messageNode.getAttribute("mesid") || messageNode.getAttribute("data-message-id") || messageNode.getAttribute("data-mes-id"));
        if (frameId) return frameId;
      }
    } catch (_) {}
    try {
      var node = script;
      while (node && node !== document.documentElement) {
        var attrs = ["mesid", "message_id", "data-message-id", "data-mes-id", "data-messageid", "data-index"];
        for (var j = 0; j < attrs.length; j += 1) {
          var value = textId(node.getAttribute && node.getAttribute(attrs[j]));
          if (value) return value;
        }
        node = node.parentElement;
      }
    } catch (_) {}
    var views = candidateWindows();
    for (var i = 0; i < views.length; i += 1) {
      var view = views[i];
      if (view === window) continue;
      try {
        if (typeof view.getCurrentMessageId === "function") {
          var direct = textId(view.getCurrentMessageId());
          if (direct) return direct;
        }
      } catch (_) {}
    }
    return "";
  }

  function findHostWindow() {
    var candidates = candidateWindows().slice().reverse();
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var view = candidates[i];
        var doc = view.document;
        if (!doc || !doc.body) continue;
        if (doc.querySelector("#chat,.mes[mesid],#send_textarea") || view.SillyTavern || typeof view.getContext === "function") return view;
      } catch (_) {}
    }
    return window;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createRegistry(host) {
    var hostDocument = host.document;
    var owners = new Map();
    var ownerOrder = [];
    var shell = null;
    var shadow = null;
    var frame = null;
    var launcher = null;
    var panel = null;
    var floorSelect = null;
    var modeButton = null;
    var stateBadge = null;
    var titleFloor = null;
    var resourcePanel = null;
    var variableFormatButton = null;
    var petCharacterButton = null;
    var variableFormatDialog = null;
    var encounterDetailHost = null;
    var encounterPossessionDecorHost = null;
    var profileNeighborHost = null;
    var profilePossessionHost = null;
    var workLeverHost = null;
    var mapExtraChainHost = null;
    var locationRuleRadarTimer = 0;
    var workLeverPointer = null;
    var selectedId = "";
    var selectionMode = "follow";
    var loadedForWritableId = "";
    var dragState = null;
    var resizeState = null;
    var launcherDragState = null;
    var suppressLauncherClick = false;
    var petSprite = null;
    var petMenu = null;
    var wandPetEntry = null;
    var wandObserver = null;
    var petMenuOpen = false;
    var petMenuLongPressTimer = 0;
    var petCharacterId = "alisa";
    var petDisplayMode = "floating";
    var petPendingCharacterId = "";
    var petSwitching = false;
    var petImageCache = new Map();
    var petLoadPromises = new Map();
    var petLoadQueue = [];
    var petLoadsInFlight = 0;
    var petTimer = 0;
    var petActivityTimer = 0;
    var petMotionFrame = 0;
    var petMotionLast = 0;
    var petState = "idle";
    var petFrame = 0;
    var petLoops = 0;
    var petDirection = 1;
    var petOriginX = 0;
    var petOriginY = 0;
    var petSpinAngle = 0;
    var petSpinCenterX = 0;
    var petSpinCenterY = 0;
    var petRoamX = 0;
    var petRoamY = 0;
    var petPointerHover = false;
    var petHasFocus = false;
    var petAssetsReady = false;
    var petReadyAssets = new Set();
    var petMotionQuery = null;
    var petMotionHandler = null;
    var petVisibilityHandler = null;
    var stageSubscribers = new Set();
    var shellOpen = false;
    var storageKey = config.storageKey;
    var mountTimer = 0;
    var profileOpenTimer = 0;
    var pendingProfileRole = "";
    var fetchController = null;
    var hostClickHandler = null;
    var hostResizeHandler = null;
    var actionFoldObserver = null;
    var actionFoldRenderFrame = 0;
    var actionFoldObservedFrames = new WeakSet();
    var resourceRefreshToken = 0;
    var resourceEventStops = [];
    var resourceEventsSubscribed = false;
    var ACTION_FOLD_OPEN = "⟪HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_CLOSE = "⟪/HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_MARKER_RE = /⟪HYPNOOS_ACTION_FOLD_V3⟫([\s\S]*?)⟪\/HYPNOOS_ACTION_FOLD_V3⟫/;

    function actionFoldText(value) {
      return String(value || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]*>/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
        .trim();
    }

    function actionFoldPlain(targetDocument, value) {
      var block = targetDocument.createElement("div");
      block.style.cssText = "margin:7px 0;color:#dbeafe;white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere";
      block.textContent = actionFoldText(value);
      return block;
    }

    function actionFoldNotice(targetDocument, value) {
      var notice = targetDocument.createElement("aside");
      notice.setAttribute("data-hypnoos-action-notice", "v3");
      notice.style.cssText = "display:flex;align-items:flex-start;gap:9px;margin:10px 0;padding:9px 11px;border:1px solid rgba(250,204,21,.42);border-left:4px solid #fbbf24;border-radius:10px;background:linear-gradient(100deg,rgba(120,53,15,.38),rgba(67,20,7,.22));color:#fef3c7";
      var label = targetDocument.createElement("strong");
      label.style.cssText = "flex:0 0 auto;color:#fde68a;font:800 11px/1.4 ui-monospace,monospace";
      label.textContent = "✦ AI 提醒";
      var body = targetDocument.createElement("span");
      body.style.cssText = "min-width:0;white-space:pre-wrap;line-height:1.55";
      body.textContent = actionFoldText(value);
      notice.append(label, body);
      return notice;
    }

    function actionFoldPermission(targetDocument, value) {
      var card = targetDocument.createElement("aside");
      card.setAttribute("data-hypnoos-action-permission", "v3");
      card.style.cssText = "margin:9px 0;padding:9px 11px;border:1px solid rgba(96,165,250,.32);border-left:4px solid #60a5fa;border-radius:10px;background:rgba(30,64,175,.14);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      card.textContent = "变量权限\n" + actionFoldText(value);
      return card;
    }

    function actionFoldNested(targetDocument, kind, titleText, bodyText) {
      var details = targetDocument.createElement("details");
      details.setAttribute(kind === "item" ? "data-hypnoos-action-item" : "data-hypnoos-action-section", "v3");
      details.style.cssText = kind === "item"
        ? "display:block;margin:7px 0;border:1px solid rgba(165,180,252,.28);border-radius:9px;overflow:hidden;background:rgba(15,23,42,.32);color:#e2e8f0"
        : "display:block;margin:9px 0;border:1px solid rgba(129,140,248,.34);border-radius:12px;overflow:hidden;background:linear-gradient(120deg,rgba(49,46,129,.30),rgba(15,23,42,.28));color:#e2e8f0";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;list-style:none;font-weight:800;line-height:1.4";
      summary.textContent = (kind === "item" ? "◆ " : "◈ ") + (actionFoldText(titleText) || (kind === "item" ? "操作项" : "来源"));
      var body = targetDocument.createElement("div");
      body.style.cssText = "padding:9px 11px 11px;border-top:1px solid rgba(165,180,252,.22);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      if (kind === "section") appendActionFoldContent(targetDocument, body, bodyText);
      else body.textContent = actionFoldText(bodyText);
      details.append(summary, body);
      return details;
    }

    function nextActionFoldUnit(source, fromIndex) {
      var definitions = [
        { kind: "permission", regex: /<\s*变量权限\s*>\s*([\s\S]*?)\s*<\s*\/\s*变量权限\s*>/gi },
        { kind: "notice", regex: /<\s*AI提醒\s*>\s*([\s\S]*?)\s*<\s*\/\s*AI提醒\s*>/gi },
        { kind: "item", regex: /<\s*操作项\s*>\s*<\s*操作名\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作名\s*>\s*<\s*操作内容\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作内容\s*>\s*<\s*\/\s*操作项\s*>/gi },
        { kind: "section", regex: /<\s*(相关变量|时钟|地图|学校|学校地图|催眠APP|催眠命令|催眠资源|催眠道具|成就和任务|成就|任务|规则|地点规则|打工|监控|邂逅|人物档案|库存|物品|派遣|警视厅|综合医院|医院|旧校舍|灵异|性格特调|改造|附身|课程表|日历|系统|设置|场景|事件|地点|APP)\s*>\s*([\s\S]*?)\s*<\s*\/\s*\1\s*>/gi }
      ];
      var selected = null;
      definitions.forEach(function (definition) {
        definition.regex.lastIndex = fromIndex;
        var match = definition.regex.exec(source);
        if (!match || (selected && match.index >= selected.start)) return;
        selected = {
          kind: definition.kind,
          start: match.index,
          end: match.index + match[0].length,
          title: definition.kind === "section" || definition.kind === "item" ? match[1] : "",
          body: definition.kind === "section" || definition.kind === "item" ? match[2] : match[1]
        };
      });
      return selected;
    }

    function appendActionFoldContent(targetDocument, parent, value) {
      var source = String(value || "");
      var cursor = 0;
      var unit;
      while ((unit = nextActionFoldUnit(source, cursor))) {
        if (unit.start > cursor) {
          var plain = actionFoldPlain(targetDocument, source.slice(cursor, unit.start));
          if (plain.textContent) parent.appendChild(plain);
        }
        if (unit.kind === "notice") parent.appendChild(actionFoldNotice(targetDocument, unit.body));
        else if (unit.kind === "permission") parent.appendChild(actionFoldPermission(targetDocument, unit.body));
        else parent.appendChild(actionFoldNested(targetDocument, unit.kind, unit.title, unit.body));
        cursor = unit.end;
      }
      if (cursor < source.length) {
        var tail = actionFoldPlain(targetDocument, source.slice(cursor));
        if (tail.textContent) parent.appendChild(tail);
      }
    }

    function createActionFoldCard(targetDocument, value) {
      var details = targetDocument.createElement("details");
      details.setAttribute("data-hypnoos-action-fold", "v3");
      details.style.cssText = "display:block;margin:12px 0;border:1px solid rgba(129,140,248,.48);border-left:3px solid #818cf8;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,rgba(30,27,75,.88),rgba(15,23,42,.92));box-shadow:0 9px 22px rgba(0,0,0,.2);color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 14px;color:#eef2ff;letter-spacing:.04em;list-style:none";
      var label = targetDocument.createElement("span");
      label.style.cssText = "font-size:11px;font-weight:800;color:#a5b4fc;letter-spacing:.16em";
      label.textContent = "前端操作";
      var title = targetDocument.createElement("strong");
      title.style.cssText = "font-size:14px;font-weight:650";
      title.textContent = "本轮操作";
      var hint = targetDocument.createElement("span");
      hint.style.cssText = "margin-left:auto;color:rgba(199,210,254,.78);font-size:12px";
      hint.textContent = "点击展开";
      summary.append(label, title, hint);
      var body = targetDocument.createElement("div");
      body.setAttribute("data-hypnoos-action-body", "v3");
      body.style.cssText = "padding:13px 17px 15px;border-top:1px solid rgba(129,140,248,.28);line-height:1.82;color:#dbeafe;overflow-wrap:anywhere";
      appendActionFoldContent(targetDocument, body, value);
      if (!body.childNodes.length) body.textContent = "本轮没有可展开的前端操作。";
      details.append(summary, body);
      return details;
    }

    function renderActionFoldRoot(targetDocument, root) {
      if (!root || !String(root.textContent || "").includes(ACTION_FOLD_OPEN)) return false;
      var walker = targetDocument.createTreeWalker(root, targetDocument.defaultView && targetDocument.defaultView.NodeFilter ? targetDocument.defaultView.NodeFilter.SHOW_TEXT : 4);
      var nodes = [];
      var source = "";
      while (walker.nextNode()) {
        var node = walker.currentNode;
        if (node.parentElement && node.parentElement.closest("[data-hypnoos-action-fold],script,style,textarea,template")) continue;
        var text = String(node.nodeValue || "");
        if (!text) continue;
        nodes.push({ node: node, start: source.length, end: source.length + text.length });
        source += text;
      }
      var rendered = false;
      for (var pass = 0; pass < 8; pass += 1) {
        var match = source.match(ACTION_FOLD_MARKER_RE);
        if (!match || match.index == null) break;
        var startIndex = match.index;
        var endIndex = startIndex + match[0].length;
        var start = nodes.find(function (item) { return startIndex >= item.start && startIndex <= item.end; });
        var end = nodes.slice().reverse().find(function (item) { return endIndex >= item.start && endIndex <= item.end; });
        if (!start || !end) break;
        var range = targetDocument.createRange();
        range.setStart(start.node, Math.max(0, startIndex - start.start));
        range.setEnd(end.node, Math.max(0, endIndex - end.start));
        range.deleteContents();
        range.insertNode(createActionFoldCard(targetDocument, match[1]));
        rendered = true;
        return renderActionFoldRoot(targetDocument, root) || rendered;
      }
      return rendered;
    }

    function actionFoldDocuments() {
      var documents = [hostDocument];
      Array.prototype.forEach.call(hostDocument.querySelectorAll("iframe"), function (iframe) {
        if (!actionFoldObservedFrames.has(iframe)) {
          actionFoldObservedFrames.add(iframe);
          try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
        }
        try {
          if (iframe.contentDocument && iframe.contentDocument.body && documents.indexOf(iframe.contentDocument) < 0) {
            documents.push(iframe.contentDocument);
          }
        } catch (_) {}
      });
      return documents;
    }

    function renderActionFoldMarkers() {
      actionFoldDocuments().forEach(function (targetDocument) {
        var roots = Array.prototype.slice.call(targetDocument.querySelectorAll(".mes_text,#userInputContent"));
        if (!roots.length && targetDocument.body) roots.push(targetDocument.body);
        roots.forEach(function (root) { renderActionFoldRoot(targetDocument, root); });
      });
    }

    function scheduleActionFoldRender() {
      if (actionFoldRenderFrame || !hostDocument.body) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(callback, 0); };
      actionFoldRenderFrame = requestFrame.call(host, function () {
        actionFoldRenderFrame = 0;
        renderActionFoldMarkers();
      });
    }

    function ensureActionFoldRenderer() {
      if (!actionFoldObserver && host.MutationObserver) {
        actionFoldObserver = new host.MutationObserver(function (records) {
          var shouldRender = records.some(function (record) {
            var targetText = record.type === "characterData" ? record.target.nodeValue : record.target && record.target.textContent;
            if (String(targetText || "").includes(ACTION_FOLD_OPEN)) return true;
            return Array.prototype.some.call(record.addedNodes || [], function (node) {
              if (String(node && node.tagName || "").toLowerCase() === "iframe" && !actionFoldObservedFrames.has(node)) {
                actionFoldObservedFrames.add(node);
                try { node.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
              }
              try {
                Array.prototype.forEach.call(node && node.querySelectorAll ? node.querySelectorAll("iframe") : [], function (iframe) {
                  if (actionFoldObservedFrames.has(iframe)) return;
                  actionFoldObservedFrames.add(iframe);
                  try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
                });
              } catch (_) {}
              return String(node && node.textContent || "").includes(ACTION_FOLD_OPEN);
            });
          });
          if (shouldRender) scheduleActionFoldRender();
        });
        actionFoldObserver.observe(hostDocument.body, { childList: true, characterData: true, subtree: true });
      }
      scheduleActionFoldRender();
    }

    var registryApi = null;
    var chatTopologyKey = "";

    function ownerAlive(owner) {
      try {
        if (!owner || !owner.view || !owner.view.document || owner.view.closed) return false;
        var frameElement = owner.view.frameElement;
        return !frameElement || frameElement.isConnected;
      } catch (_) { return false; }
    }

    function pruneOwners() {
      ownerOrder = ownerOrder.filter(function (id) {
        var owner = owners.get(id);
        if (ownerAlive(owner)) return true;
        owners.delete(id);
        return false;
      });
    }

    function latestOwner() {
      pruneOwners();
	  var alive = ownerOrder.map(function (id) { return owners.get(id); }).filter(ownerAlive);
	  var numeric = alive.filter(function (owner) { return Number.isFinite(Number(owner.messageId)); });
	  if (numeric.length === alive.length && numeric.length) {
	    numeric.sort(function (a, b) { return Number(a.messageId) - Number(b.messageId); });
	    return numeric[numeric.length - 1];
	  }
      for (var i = ownerOrder.length - 1; i >= 0; i -= 1) {
        var owner = owners.get(ownerOrder[i]);
        if (ownerAlive(owner)) return owner;
      }
      return null;
    }

    function writableId() {
      var records = visibleAssistantRecords();
      if (records.length && records[records.length - 1].id) return records[records.length - 1].id;
      return textId(latestOwner() && latestOwner().messageId);
    }

    function sourceWindows() {
      var list = [];
      var owner = latestOwner();
      [owner && owner.view, host, host.parent, host.top].forEach(function (view) {
        try { if (view && list.indexOf(view) < 0) list.push(view); } catch (_) {}
      });
      return list;
    }

    function findFunction(name) {
      try {
        var directBridge = config.bridgeKey && host[config.bridgeKey];
        if (directBridge && typeof directBridge[name] === "function") return { view: directBridge, fn: directBridge[name] };
      } catch (_) {}
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          if (typeof views[i][name] === "function") return { view: views[i], fn: views[i][name] };
          if (views[i].TavernHelper && typeof views[i].TavernHelper[name] === "function") {
            return { view: views[i].TavernHelper, fn: views[i].TavernHelper[name] };
          }
        } catch (_) {}
      }
      return null;
    }

    function findMvu() {
      try {
        var directBridge = config.bridgeKey && host[config.bridgeKey];
        if (directBridge && directBridge.Mvu) return directBridge.Mvu;
      } catch (_) {}
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try { if (views[i].Mvu) return views[i].Mvu; } catch (_) {}
      }
      return null;
    }

    function normalizeMessageOption(option) {
      if (option && typeof option === "object" && option.type && option.type !== "message") return option;
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function normalizeWriteMessageOption(option) {
      if (option && typeof option === "object") {
        if (option.type && option.type !== "message") return option;
        var explicit = textId(option.message_id !== undefined ? option.message_id : option.mesid);
        if (explicit) return { type: "message", message_id: explicit };
      }
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function callApi(name, args) {
      var found = findFunction(name);
      if (!found) return undefined;
      return found.fn.apply(found.view, Array.isArray(args) ? args : []);
    }

    function callMvu(name, args) {
      var mvu = findMvu();
      if (!mvu || typeof mvu[name] !== "function") return undefined;
      return mvu[name].apply(mvu, Array.isArray(args) ? args : []);
    }

    async function importHostWorldInfoModule() {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          if (typeof views[i].eval !== "function") continue;
          var mod = await Promise.resolve(views[i].eval("import('/scripts/world-info.js')"));
          if (mod && typeof mod.loadWorldInfo === "function" && typeof mod.saveWorldInfo === "function") return mod;
        } catch (_) {}
      }
      return null;
    }

    async function hostRequestHeaders() {
      var ctx = context();
      if (ctx && typeof ctx.getRequestHeaders === "function") {
        return ctx.getRequestHeaders();
      }
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          var api = views[i].SillyTavern
            || (views[i].TavernHelper && views[i].TavernHelper.SillyTavern);
          if (!api) continue;
          var apiContext = typeof api.getContext === "function" ? api.getContext() : api;
          if (apiContext && typeof apiContext.getRequestHeaders === "function") {
            return apiContext.getRequestHeaders();
          }
        } catch (_) {}
      }
      throw new Error("无法从 SillyTavern.getContext() 取得同源请求头。");
    }

    function rawWorldbookEntries(data) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== "object") return [];
      var container = data.entries || data.entry || data.world_info;
      if (Array.isArray(container)) return container;
      if (container && typeof container === "object") return Object.values(container);
      return [];
    }

    function rawOpeningEntry(entry, uid, displayIndex) {
      var strategy = entry && entry.strategy && typeof entry.strategy === "object" ? entry.strategy : {};
      var secondary = strategy.keys_secondary && typeof strategy.keys_secondary === "object" ? strategy.keys_secondary : {};
      var position = entry && entry.position && typeof entry.position === "object" ? entry.position : {};
      var recursion = entry && entry.recursion && typeof entry.recursion === "object" ? entry.recursion : {};
      var effect = entry && entry.effect && typeof entry.effect === "object" ? entry.effect : {};
      var positionCode = {
        before_character_definition: 0,
        after_character_definition: 1,
        before_author_note: 2,
        after_author_note: 3,
        at_depth: 4,
        before_example_messages: 5,
        after_example_messages: 6,
        outlet: 7
      };
      var roleCode = { system: 0, user: 1, assistant: 2 };
      var secondaryLogic = { and_any: 0, not_all: 1, not_any: 2, and_all: 3 };
      var strategyType = textId(strategy.type) || "constant";
      return {
        uid: uid,
        displayIndex: displayIndex,
        comment: textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment)),
        disable: entry && entry.enabled === false,
        constant: strategyType === "constant",
        selective: strategyType === "selective",
        key: Array.isArray(strategy.keys) ? strategy.keys.slice() : [],
        keysecondary: Array.isArray(secondary.keys) ? secondary.keys.slice() : [],
        selectiveLogic: secondaryLogic[textId(secondary.logic)] !== undefined ? secondaryLogic[textId(secondary.logic)] : 0,
        scanDepth: strategy.scan_depth === "same_as_global" ? null : (Number.isFinite(Number(strategy.scan_depth)) ? Number(strategy.scan_depth) : null),
        vectorized: strategyType === "vectorized",
        position: positionCode[textId(position.type)] !== undefined ? positionCode[textId(position.type)] : 0,
        role: roleCode[textId(position.role)] !== undefined ? roleCode[textId(position.role)] : 0,
        depth: Number.isFinite(Number(position.depth)) ? Number(position.depth) : 4,
        order: Number.isFinite(Number(position.order)) ? Number(position.order) : 100,
        content: String(entry && entry.content || ""),
        useProbability: true,
        probability: Number.isFinite(Number(entry && entry.probability)) ? Number(entry.probability) : 100,
        excludeRecursion: Boolean(recursion.prevent_incoming),
        preventRecursion: Boolean(recursion.prevent_outgoing),
        delayUntilRecursion: recursion.delay_until === null || recursion.delay_until === undefined ? false : recursion.delay_until,
        sticky: effect.sticky === undefined ? null : effect.sticky,
        cooldown: effect.cooldown === undefined ? null : effect.cooldown,
        delay: effect.delay === undefined ? null : effect.delay,
        extra: entry && entry.extra && typeof entry.extra === "object" ? Object.assign({}, entry.extra) : {}
      };
    }

    async function ensureOpeningWorldbooksRaw(mod, worldName, requested) {
      var data = await Promise.resolve(mod.loadWorldInfo(worldName));
      if (!data || typeof data !== "object") return null;
      var currentEntries = rawWorldbookEntries(data);
      var repairedKeyArrays = 0;
      currentEntries.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        if (!Array.isArray(item.key)) {
          item.key = Array.isArray(item.keys) ? item.keys.slice() : [];
          repairedKeyArrays += 1;
        }
        if (!Array.isArray(item.keysecondary)) {
          item.keysecondary = Array.isArray(item.secondary_keys) ? item.secondary_keys.slice() : [];
          repairedKeyArrays += 1;
        }
      });
      var pending = [];
      var existing = 0;
      for (var i = 0; i < requested.length; i += 1) {
        var entry = requested[i];
        var comment = textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment));
        var found = currentEntries.find(function (item) {
          return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment;
        });
        if (!found) {
          pending.push(entry);
          continue;
        }
        if (String(found.content || "") !== String(entry.content || "")) {
          return { ok: false, reason: "角色卡世界书已有同名但内容不同的条目：" + comment };
        }
        existing += 1;
      }
      if (!pending.length && !repairedKeyArrays) {
        return { ok: true, inserted: 0, existing: existing, targetWorldbook: worldName, method: "host-native-raw" };
      }
      var maxUid = currentEntries.reduce(function (max, item) {
        return Math.max(max, Number(item && item.uid) || 0);
      }, 0);
      var maxDisplayIndex = currentEntries.reduce(function (max, item) {
        return Math.max(max, Number(item && item.displayIndex) || 0);
      }, -1);
      var container = data.entries || data.entry || data.world_info;
      if (!container || typeof container !== "object") {
        data.entries = {};
        container = data.entries;
      }
      for (var p = 0; p < pending.length; p += 1) {
        maxUid += 1;
        maxDisplayIndex += 1;
        var raw = rawOpeningEntry(pending[p], maxUid, maxDisplayIndex);
        if (Array.isArray(container)) container.push(raw);
        else container[maxUid] = raw;
      }
      var saveError = null;
      try {
        await Promise.resolve(mod.saveWorldInfo(worldName, data, true));
      } catch (error) {
        saveError = error;
      }
      if (saveError) {
        var reloaded = await Promise.resolve(mod.loadWorldInfo(worldName));
        var savedEntries = rawWorldbookEntries(reloaded);
        var allSaved = savedEntries.every(function (item) {
          return Array.isArray(item && item.key) && Array.isArray(item && item.keysecondary);
        }) && pending.every(function (entry) {
          var comment = textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment));
          return savedEntries.some(function (item) {
            return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment
              && String(item && item.content || "") === String(entry && entry.content || "");
          });
        });
        if (!allSaved) throw saveError;
      }
      try { await Promise.resolve(mod.updateWorldInfoList && mod.updateWorldInfoList()); } catch (_) {}
      return {
        ok: true,
        inserted: pending.length,
        existing: existing,
        repaired: repairedKeyArrays,
        targetWorldbook: worldName,
        method: "host-native-raw"
      };
    }

    async function ensureOpeningWorldbooks(entries, fallbackName) {
      var requested = Array.isArray(entries) ? entries.filter(function (entry) {
        return entry && typeof entry === "object" && String(entry.name || entry.comment || "").trim();
      }) : [];
      if (!requested.length) return { ok: true, skipped: true, inserted: 0, existing: 0 };
      try {
        var books = await Promise.resolve(callApi("getCharWorldbookNames", ["current"])) || {};
        var worldName = textId(books.primary || books.primary_world || books.world || books.name);
        if (!worldName) {
          worldName = textId(fallbackName) || "当前角色卡 邂逅世界书";
          var createWorldbook = findFunction("createWorldbook");
          var rebindWorldbooks = findFunction("rebindCharWorldbooks");
          if (!createWorldbook || !rebindWorldbooks) {
            return { ok: false, reason: "角色卡尚未绑定世界书，且宿主缺少绑定接口。" };
          }
          try {
            await Promise.resolve(createWorldbook.fn.call(createWorldbook.view, worldName, []));
          } catch (_) {}
          await Promise.resolve(rebindWorldbooks.fn.call(rebindWorldbooks.view, "current", {
            primary: worldName,
            additional: Array.isArray(books.additional) ? books.additional : []
          }));
        }
        var nativeWorldInfo = await importHostWorldInfoModule();
        if (nativeWorldInfo) {
          var rawResult = await ensureOpeningWorldbooksRaw(nativeWorldInfo, worldName, requested);
          if (rawResult) return rawResult;
        }
        var current = await Promise.resolve(callApi("getWorldbook", [worldName]));
        var currentEntries = Array.isArray(current)
          ? current
          : (current && typeof current === "object"
            ? (Array.isArray(current.entries) ? current.entries : Object.values(current.entries || current.entry || current.world_info || {}))
            : []);
        var existing = 0;
        var pending = [];
        for (var i = 0; i < requested.length; i += 1) {
          var entry = requested[i];
          var comment = textId(entry.name || entry.comment || entry.extra && entry.extra.comment);
          var found = currentEntries.find(function (item) {
            return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment;
          });
          if (!found) {
            pending.push(entry);
            continue;
          }
          if (String(found.content || "") !== String(entry.content || "")) {
            return { ok: false, reason: "角色卡世界书已有同名但内容不同的条目：" + comment };
          }
          existing += 1;
        }
        if (pending.length) {
          var createEntries = findFunction("createWorldbookEntries");
          if (!createEntries) return { ok: false, reason: "宿主缺少世界书条目写入接口。" };
          await Promise.resolve(createEntries.fn.call(createEntries.view, worldName, pending, { render: "immediate" }));
        }
        return { ok: true, inserted: pending.length, existing: existing, targetWorldbook: worldName, method: "host-bridge" };
      } catch (error) {
        return { ok: false, reason: String(error && error.message || error || "宿主写入世界书失败。") };
      }
    }

    function cloneSnapshot(value) {
      if (!value || typeof value !== "object") return value;
      try {
        if (typeof host.structuredClone === "function") return host.structuredClone(value);
      } catch (_) {}
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }

    function cloneReadResult(value) {
      if (value && typeof value.then === "function") return value.then(cloneSnapshot);
      return cloneSnapshot(value);
    }

    function readApi(name, args) {
      return cloneReadResult(callApi(name, args));
    }

    function readMvu(name, args) {
      return cloneReadResult(callMvu(name, args));
    }

    function isWritable() {
      var selected = textId(selectedId || writableId());
      return Boolean(selected && selected === writableId());
    }

    function explicitMessageIds(value, depth) {
      if (!value || typeof value !== "object" || depth > 3) return [];
      if (Array.isArray(value)) {
        return value.reduce(function (ids, item) { return ids.concat(explicitMessageIds(item, depth + 1)); }, []);
      }
      var ids = [];
      if (value.message_id !== undefined || value.mesid !== undefined) {
        var direct = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (direct) ids.push(direct);
      }
      if (String(value.type || "").toLowerCase() === "message") {
        var optionId = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (optionId) ids.push(optionId);
      }
      return ids;
    }

    function writeTargetsWritable(name, args) {
      var target = writableId();
      if (!target) return false;
      var ids = [];
      (Array.isArray(args) ? args : []).forEach(function (arg) {
        ids = ids.concat(explicitMessageIds(arg, 0));
      });
      if (name === "setChatMessages" && !ids.length) return false;
      return ids.every(function (id) { return id === target; });
    }

    function guardedApi(name, args) {
      if (!isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callApi(name, args);
    }

    function guardedMvu(name, args) {
      if (!isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callMvu(name, args);
    }

    function context() {
      for (var i = 0; i < sourceWindows().length; i += 1) {
        var view = sourceWindows()[i];
        try {
          var result = view.SillyTavern && view.SillyTavern.getContext ? view.SillyTavern.getContext() : null;
          if (!result && typeof view.getContext === "function") result = view.getContext();
          if (result) return result;
        } catch (_) {}
      }
      return null;
    }

    function chatMessages() {
      var ctx = context();
      if (Array.isArray(ctx && ctx.chat)) return ctx.chat;
      for (var i = 0; i < sourceWindows().length; i += 1) {
        try { if (Array.isArray(sourceWindows()[i].chat)) return sourceWindows()[i].chat; } catch (_) {}
      }
      return [];
    }

    function messageId(message, index) {
      if (message && typeof message === "object") {
        var stable = textId(message.message_id);
        if (stable) return stable;
      }
      return String(index);
    }

    function isUserMessage(message, index) {
      if (!message || typeof message !== "object") return false;
      if (message.is_user === true || message.isUser === true || message.from_user === true) return true;
      if (message.is_user === false || message.isUser === false || message.from_user === false) return false;
      var role = String(message.role || message.type || message.sender || "").toLowerCase();
      if (role === "user" || role === "human") return true;
      if (["assistant", "character", "bot", "model", "system"].indexOf(role) >= 0) return false;
      return Number.isInteger(Number(index)) ? Number(index) % 2 === 1 : false;
    }

    function isVisibleAssistantMessage(message, index) {
      if (!message || typeof message !== "object" || isUserMessage(message, index)) return false;
      if (
        message.is_system === true || message.isSystem === true || message.system === true
        || message.hidden === true || message.is_hidden === true || message.isHidden === true
        || message.internal === true || message.is_internal === true
        || message.extra_model === true || message.is_extra_model === true || message.extraModel === true
        || message.deleted === true || message.is_deleted === true
      ) return false;
      var role = String(message.role || message.type || message.sender || "").toLowerCase();
      if (["system", "model", "tool", "function", "analysis", "internal"].indexOf(role) >= 0) return false;
      return message.is_user === false || message.isUser === false || message.from_user === false
        || ["assistant", "character", "bot"].indexOf(role) >= 0;
    }

    function visibleAssistantRecords() {
      var records = [];
      chatMessages().forEach(function (message, index) {
        if (!isVisibleAssistantMessage(message, index)) return;
        records.push({
          message: message,
          index: index,
          id: messageId(message, index)
        });
      });
      return records;
    }

    function chatTopologySignature() {
      return visibleAssistantRecords().map(function (record) {
        var message = record.message || {};
        var swipe = Number(message.swipe_id !== undefined ? message.swipe_id : message.swipeId);
        var stamp = textId(message.send_date || message.gen_started || message.gen_finished || message.created_at);
        var body = String(message.mes || message.message || message.content || "");
        return record.id + ":" + (Number.isFinite(swipe) ? swipe : 0) + ":" + stamp + ":" + body.length;
      }).join("|");
    }

    function unwrapStat(value) {
      return value && typeof value === "object" && value.stat_data && typeof value.stat_data === "object" ? value.stat_data : value;
    }

    function usableSnapshot(value) {
      var root = unwrapStat(value);
      return Boolean(root && typeof root === "object" && !Array.isArray(root) &&
        ((root["系统"] && typeof root["系统"] === "object") || (root["角色"] && typeof root["角色"] === "object")));
    }

    function formatResourceValue(value) {
      if (value === undefined || value === null || value === "") return "--";
      var number = Number(value);
      if (Number.isFinite(number)) return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
      return String(value);
    }

    function paintSidecarResources(system, loading) {
      if (!resourcePanel) return;
      resourcePanel.classList.toggle("loading", Boolean(loading));
      var values = {
        money: system && system["持有零花钱"],
        starlight: system && system["星光点"],
        energy: system && system["MC能量"]
      };
      Object.keys(values).forEach(function (key) {
        var target = resourcePanel.querySelector("[data-resource-" + key + "]");
        if (target) target.textContent = formatResourceValue(values[key]);
      });
    }

    async function refreshSidecarResources() {
      if (!resourcePanel) return;
      var token = ++resourceRefreshToken;
      var id = textId(selectedId || writableId());
      if (!id) {
        paintSidecarResources(null, false);
        return;
      }
      paintSidecarResources(null, true);
      var option = { type: "message", message_id: id };
      var snapshot = null;
      try { snapshot = await Promise.resolve(callMvu("getMvuData", [option])); } catch (_) {}
      if (!usableSnapshot(snapshot)) {
        try { snapshot = await Promise.resolve(callApi("getVariables", [option])); } catch (_) {}
      }
      if (token !== resourceRefreshToken || id !== textId(selectedId || writableId())) return;
      var root = usableSnapshot(snapshot) ? unwrapStat(snapshot) : null;
      paintSidecarResources(root && root["系统"], false);
    }

    async function readInformationSnapshot() {
      var id = textId(selectedId || writableId());
      var option = { type: "message", message_id: id };
      var snapshot = null;
      try { snapshot = await Promise.resolve(callMvu("getMvuData", [option])); } catch (_) {}
      if (!usableSnapshot(snapshot)) {
        try { snapshot = await Promise.resolve(callApi("getVariables", [option])); } catch (_) {}
      }
      var root = usableSnapshot(snapshot) ? unwrapStat(snapshot) : null;
      var system = root && root["系统"] && typeof root["系统"] === "object" ? root["系统"] : {};
      return {
        selectedId: id,
        writableId: writableId(),
        writable: isWritable(),
        mode: selectionMode,
        petCharacterId: petCharacterId,
        petCharacterName: PET_CHARACTER_NAMES[petCharacterId] || petCharacterId,
        petDisplayMode: petDisplayMode,
        petCharacters: PET_CHARACTER_ORDER.map(function (id) {
          return { id: id, name: PET_CHARACTER_NAMES[id] || id };
        }),
        resources: {
          money: system["持有零花钱"] ?? null,
          starlight: system["星光点"] ?? null,
          energy: system["MC能量"] ?? null
        },
        variableReport: phoneApi("__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__", [], true) || null,
        floors: floorItems().map(function (item) {
          return {
            id: item.id,
            floor: item.floor,
            swipe: item.swipe,
            snapshot: Boolean(item.snapshot),
            current: item.id === writableId()
          };
        })
      };
    }

    function paintVariableFormatButton(report) {
      if (!variableFormatButton) return;
      var data = report && typeof report === "object" ? report : null;
      var extra = Math.max(0, Number(data && data.extraCount) || 0);
      var missing = Math.max(0, Number(data && data.missingCount) || 0);
      variableFormatButton.classList.toggle("warn", extra > 0);
      variableFormatButton.classList.toggle("missing", extra <= 0 && missing > 0);
      variableFormatButton.textContent = extra > 0
        ? "未知键 " + extra
        : missing > 0
          ? "缺少字段 " + missing
          : data && data.hasData
            ? "变量格式正常"
            : "变量格式检查";
      variableFormatButton.setAttribute("aria-label", extra > 0
        ? "变量格式发现 " + extra + " 个未知键"
        : missing > 0
          ? "变量格式缺少 " + missing + " 个字段"
          : "检查当前楼层变量格式");
    }

    function refreshVariableFormatCheck() {
      paintVariableFormatButton(phoneApi("__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__", [], true));
    }

    function closeVariableFormatDialog() {
      if (!variableFormatDialog) return;
      variableFormatDialog.classList.remove("open");
      variableFormatDialog.setAttribute("aria-hidden", "true");
    }

    function openVariableFormatDialog() {
      if (!variableFormatDialog) return;
      var report = phoneApi("__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__", [], true);
      var title = variableFormatDialog.querySelector("[data-variable-format-title]");
      var body = variableFormatDialog.querySelector("[data-variable-format-body]");
      var repair = variableFormatDialog.querySelector("[data-variable-format-repair]");
      var card = variableFormatDialog.querySelector(".variable-format-dialog__card");
      var extra = Math.max(0, Number(report && report.extraCount) || 0);
      var missing = Math.max(0, Number(report && report.missingCount) || 0);
      var extraPaths = Array.isArray(report && report.extraPaths) ? report.extraPaths : [];
      var missingPaths = Array.isArray(report && report.missingPaths) ? report.missingPaths : [];
      if (title) title.textContent = extra > 0 ? "发现未知变量键" : missing > 0 ? "变量字段不完整" : "变量格式检查";
      if (card) card.classList.toggle("warn", extra > 0);
      if (body) {
        body.textContent = !report || !report.hasData
          ? "当前楼层没有读到可检查的 MVU 变量。"
          : "未知键：" + extra + " 项" +
            (extraPaths.length ? "\n" + extraPaths.join("\n") : "") +
            "\n\n缺少字段：" + missing + " 项" +
            (missingPaths.length ? "\n" + missingPaths.join("\n") : "") +
            (report.writable ? "\n\n可清理当前最新楼。合法的角色名、任务根键和物品名会保留。" : "\n\n历史楼层只读，只能查看报告。");
      }
      if (repair) {
        repair.disabled = !report || !report.hasData || !report.writable || (!extra && !missing);
        repair.textContent = extra > 0 ? "清理并补齐" : "补齐缺少字段";
      }
      variableFormatDialog.classList.add("open");
      variableFormatDialog.setAttribute("aria-hidden", "false");
    }

    function subscribeSidecarResourceEvents() {
      if (resourceEventsSubscribed) return;
      resourceEventsSubscribed = true;
      var found = findFunction("eventOn");
      if (!found) return;
      var events = [];
      var mvu = findMvu();
      try {
        events.push(mvu?.events?.VARIABLE_INITIALIZED, mvu?.events?.VARIABLE_UPDATE_ENDED);
      } catch (_) {}
      sourceWindows().forEach(function (view) {
        try {
          var characterMessageRendered = view.tavern_events?.CHARACTER_MESSAGE_RENDERED;
          events.push(
            view.tavern_events?.CHAT_CHANGED,
            view.tavern_events?.MESSAGE_SWIPED,
            characterMessageRendered
          );
        } catch (_) {}
      });
      Array.from(new Set(events.filter(Boolean))).forEach(function (eventName) {
        var handler = function () {
          refreshSidecarResources();
          refreshVariableFormatCheck();
        };
        try {
          resourceEventStops.push({
            eventName: eventName,
            handler: handler,
            handle: found.fn.call(found.view, eventName, handler)
          });
        } catch (_) {}
      });
    }

    function snapshotExists(id, message) {
      var option = { type: "message", message_id: id };
      try {
        var mvu = callMvu("getMvuData", [option]);
        if (mvu && typeof mvu.then !== "function" && usableSnapshot(mvu)) return true;
      } catch (_) {}
      try {
        var vars = callApi("getVariables", [option]);
        if (vars && typeof vars.then !== "function" && usableSnapshot(vars)) return true;
      } catch (_) {}
      try {
        var swipeIndex = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        var swipes = message && (message.swipes_data || message.swipe_data);
        if (Array.isArray(swipes) && usableSnapshot(swipes[Number.isFinite(swipeIndex) ? swipeIndex : 0])) return true;
        if (usableSnapshot(message && (message.variables || message.mvu || message.stat_data))) return true;
      } catch (_) {}
      return false;
    }

    function floorItems() {
      var result = [];
      visibleAssistantRecords().forEach(function (record) {
        var message = record.message;
        var index = record.index;
        var id = record.id;
        var swipe = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        result.push({
          id: id,
          floor: index,
          swipe: Number.isFinite(swipe) ? swipe + 1 : 1,
          snapshot: snapshotExists(id, message)
        });
      });
      if (!result.length) {
        ownerOrder.forEach(function (id, index) {
          var owner = owners.get(id);
          if (ownerAlive(owner)) result.push({ id: id, floor: index, swipe: 1, snapshot: snapshotExists(id, null) });
        });
      }
      return result.slice(-4);
    }

    function reconcileChatState() {
      var nextKey = chatTopologySignature();
      var changed = nextKey !== chatTopologyKey;
      chatTopologyKey = nextKey;
      var allowed = floorItems().map(function (item) { return item.id; });
      if (selectedId && allowed.indexOf(selectedId) < 0) {
        selectedId = writableId();
        selectionMode = "follow";
        changed = true;
      }
      if (changed) {
        loadedForWritableId = "";
        try { if (frame) frame.dataset.loadedFor = ""; } catch (_) {}
        try { if (fetchController) fetchController.abort(); } catch (_) {}
      }
      return changed;
    }

    function mesIdFromElement(element) {
      var node = element && element.closest ? element.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (!node) return "";
      return textId(node.getAttribute("mesid") || node.getAttribute("data-message-id") || node.getAttribute("data-mes-id"));
    }

    function nearestVisibleFloor() {
      var nodes = Array.prototype.slice.call(hostDocument.querySelectorAll(".mes[mesid],.mes[data-message-id],.mes[data-mes-id]"));
      if (!nodes.length) return "";
      var center = host.innerHeight / 2;
      var best = null;
      nodes.forEach(function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= host.innerHeight) return;
        var distance = Math.abs((rect.top + rect.bottom) / 2 - center);
        if (!best || distance < best.distance) best = { id: mesIdFromElement(node), distance: distance };
      });
      return best && best.id ? best.id : "";
    }

    function selectFloor(id, mode) {
      var next = textId(id) || writableId();
      if (!next) return;
      selectedId = next;
      if (mode) selectionMode = mode;
      saveUiState();
      updateChrome();
      refreshPhone();
      notifyStages();
    }

    function followVisibleFloor() {
      var visible = nearestVisibleFloor();
      var ids = floorItems().map(function (item) { return item.id; });
      selectFloor(ids.indexOf(visible) >= 0 ? visible : writableId(), "follow");
    }

    function readUiState() {
      try {
        return JSON.parse(host.localStorage.getItem(storageKey) || "{}") || {};
      } catch (_) { return {}; }
    }

    function loadUiState() {
      var saved = readUiState();
      selectionMode = saved && saved.mode === "manual" ? "manual" : "follow";
      if (saved && saved.selectedId) selectedId = textId(saved.selectedId);
      if (saved && PET_CHARACTER_ORDER.indexOf(saved.petCharacterId) >= 0) {
        petCharacterId = saved.petCharacterId;
      }
      petDisplayMode = saved && saved.petDisplayMode === "stored" ? "stored" : "floating";
      return saved;
    }

    function saveUiState() {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: current.launcherX,
          launcherY: current.launcherY,
          scale: current.scale,
          petCharacterId: petCharacterId,
          petDisplayMode: petDisplayMode
        }));
      } catch (_) {}
    }

    function savePosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: Math.round(x),
          y: Math.round(y),
          launcherX: current.launcherX,
          launcherY: current.launcherY,
          scale: current.scale,
          petCharacterId: petCharacterId,
          petDisplayMode: petDisplayMode
        }));
      } catch (_) {}
    }

    function saveLauncherPosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: Math.round(x),
          launcherY: Math.round(y),
          scale: current.scale,
          petCharacterId: petCharacterId,
          petDisplayMode: petDisplayMode
        }));
      } catch (_) {}
    }

    function savePhoneScale(scale, x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: Math.round(x),
          y: Math.round(y),
          launcherX: current.launcherX,
          launcherY: current.launcherY,
          scale: normalizedPhoneScale(scale),
          petCharacterId: petCharacterId,
          petDisplayMode: petDisplayMode
        }));
      } catch (_) {}
    }

    function hostViewportRect() {
      var viewport = host.visualViewport;
      return {
        left: Math.max(0, Number(viewport && viewport.offsetLeft) || 0),
        top: Math.max(0, Number(viewport && viewport.offsetTop) || 0),
        width: Math.max(1, Number(viewport && viewport.width) || Number(host.innerWidth) || 1),
        height: Math.max(1, Number(viewport && viewport.height) || Number(host.innerHeight) || 1)
      };
    }

    function panelSidecarReserve(width) {
      return 0;
    }

    function normalizedPhoneScale(value) {
      var number = Number(value);
      return Number.isFinite(number) ? Math.max(0.55, Math.min(1.5, number)) : 1;
    }

    function syncPanelSize(requestedScale) {
      if (!panel) return;
      var baseWidth = 430;
      var baseHeight = 812;
      var viewport = hostViewportRect();
      var viewportWidth = viewport.width;
      var viewportHeight = viewport.height;
      var widthAllowance = Math.max(1, viewportWidth - 16);
      var heightAllowance = Math.max(1, viewportHeight - 16);
      var saved = readUiState();
      var preferred = normalizedPhoneScale(requestedScale === undefined ? saved.scale : requestedScale);
      var scale = Math.min(preferred, widthAllowance / baseWidth, heightAllowance / baseHeight);
      panel.style.width = Math.max(1, Math.floor(baseWidth * scale)) + "px";
      panel.style.height = Math.max(1, Math.floor(baseHeight * scale)) + "px";
      panel.style.setProperty("--phone-scale", String(scale));
      panel.dataset.phoneScale = String(scale);
      return scale;
    }

    function clampPosition(x, y) {
      var viewport = hostViewportRect();
      var rect = panel?.getBoundingClientRect?.();
      var width = rect?.width || (panel ? panel.offsetWidth : Math.min(760, viewport.width - 24));
      var height = rect?.height || (panel ? panel.offsetHeight : Math.min(900, viewport.height - 24));
      var sidecar = panelSidecarReserve(width);
      var lowerBoundX = viewport.left + 8;
      var upperX = Math.max(lowerBoundX, viewport.left + viewport.width - width - sidecar - 8);
      var lowerX = panel?.classList?.contains("profile-neighbors") && upperX >= viewport.left + 82
        ? viewport.left + 82
        : lowerBoundX;
      var lowerY = viewport.top + 8;
      return {
        x: Math.max(lowerX, Math.min(Number(x) || lowerX, upperX)),
        y: Math.max(lowerY, Math.min(Number(y) || lowerY, Math.max(lowerY, viewport.top + viewport.height - height - 8)))
      };
    }

    function clampLauncherPosition(x, y) {
      var viewport = hostViewportRect();
      var width = launcher ? launcher.offsetWidth : 58;
      var height = launcher ? launcher.offsetHeight : 58;
      var lowerX = viewport.left + 8;
      var lowerY = viewport.top + 8;
      return {
        x: Math.max(lowerX, Math.min(Number(x) || lowerX, Math.max(lowerX, viewport.left + viewport.width - width - 8))),
        y: Math.max(lowerY, Math.min(Number(y) || lowerY, Math.max(lowerY, viewport.top + viewport.height - height - 8)))
      };
    }

    function applySavedPosition() {
      if (!panel) return;
      syncPanelSize();
      var viewport = hostViewportRect();
      var saved = readUiState();
      var rect = panel.getBoundingClientRect();
      var fallbackX = Math.max(viewport.left + 8, viewport.left + viewport.width - rect.width - 28);
      var fallbackY = Math.max(viewport.top + 8, Math.min(viewport.top + 88, viewport.top + viewport.height - rect.height - 8));
      var next = clampPosition(saved.x === undefined ? fallbackX : saved.x, saved.y === undefined ? fallbackY : saved.y);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function applySavedLauncherPosition() {
      if (!launcher) return;
      var viewport = hostViewportRect();
      var saved = readUiState();
      var fallbackX = Math.max(viewport.left + 8, viewport.left + viewport.width - launcher.offsetWidth - 22);
      var fallbackY = Math.max(viewport.top + 8, viewport.top + viewport.height - launcher.offsetHeight - 90);
      var next = clampLauncherPosition(
        saved.launcherX === undefined ? fallbackX : saved.launcherX,
        saved.launcherY === undefined ? fallbackY : saved.launcherY
      );
      launcher.style.left = next.x + "px";
      launcher.style.top = next.y + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      launcher.style.transform = "translate3d(0,0,0)";
      petOriginX = next.x;
      petOriginY = next.y;
      petRoamX = 0;
      petRoamY = 0;
    }

    function petAssetUrl(name) {
      return String(config.assetBase || "").replace(/\/?$/, "/") + "pet/" + name;
    }

    var PET_BASE_FACING = 1;
    var PET_RENDER_SIZE = 96;
    var PET_DRAG_GRIP_Y = 5;
    var PET_CHARACTER_ORDER = ["miku", "rem", "mai", "umaru", "alisa", "hyakka"];
    var PET_CHARACTER_NAMES = {
      miku: "初音未来",
      rem: "蕾姆",
      mai: "樱岛麻衣",
      umaru: "土间埋",
      alisa: "爱丽莎",
      hyakka: "千杀百花"
    };
    var MAX_DECODED_PET_SHEETS = 8;
    var MAX_PET_LOADS_IN_FLIGHT = 2;
    var petStates = {
      idle: { group: "idle", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      unique_a: { group: "unique-a", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      unique_b: { group: "unique-b", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      held_scared: { group: "drag", total: 8, start: 0, end: 7, fps: 6, loops: Infinity },
      landing: { group: "landing", total: 12, start: 0, end: 11, fps: 10, loops: 1 },
      enter: { group: "enter", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      exit: { group: "exit", total: 8, start: 0, end: 7, fps: 7, loops: 1 }
    };

    function petAssetName(group, characterId) {
      var role = PET_CHARACTER_ORDER.indexOf(characterId) >= 0 ? characterId : "alisa";
      return "v5/" + role + "/" + role + "-" + group + "-v5.png";
    }

    function petStateAsset(name, characterId) {
      return petAssetName(petStateMeta(name).group, characterId || petCharacterId);
    }

    function petStateMeta(name) {
      return petStates[name] || petStates.idle;
    }

    function petReducedMotion() {
      return Boolean(petMotionQuery && petMotionQuery.matches);
    }

    function clearPetFrameTimer() {
      if (petTimer) host.clearTimeout(petTimer);
      petTimer = 0;
    }

    function clearPetActivityTimer() {
      if (petActivityTimer) host.clearTimeout(petActivityTimer);
      petActivityTimer = 0;
    }

    function clearPetMotionFrame() {
      if (petMotionFrame) {
        if (host.cancelAnimationFrame) host.cancelAnimationFrame(petMotionFrame);
        else host.clearTimeout(petMotionFrame);
      }
      petMotionFrame = 0;
      petMotionLast = 0;
    }

    function setPetDirection(direction) {
      var next = Number(direction) < 0 ? -1 : 1;
      if (next === petDirection && petSprite) return;
      petDirection = next;
      if (!petSprite) return;
      var meta = petStateMeta(petState);
      var visualScale = meta.directional && petDirection !== PET_BASE_FACING ? -1 : 1;
      petSprite.style.setProperty("--pet-facing-scale", String(visualScale));
    }

    function applyPetStateAppearance() {
      if (!petSprite) return;
      var meta = petStateMeta(petState);
      petSprite.style.backgroundImage = "url('" + petAssetUrl(petStateAsset(petState)).replace(/'/g, "%27") + "')";
      petSprite.style.backgroundSize = (meta.total * PET_RENDER_SIZE) + "px " + PET_RENDER_SIZE + "px";
      petSprite.style.setProperty("--pet-lift", "0px");
      if (launcher) {
        launcher.dataset.petState = petState;
        launcher.dataset.petCharacter = petCharacterId;
      }
      var visualScale = meta.directional && petDirection !== PET_BASE_FACING ? -1 : 1;
      petSprite.style.setProperty("--pet-facing-scale", String(visualScale));
    }

    function applyPetFrame() {
      if (!petSprite) return;
      petSprite.style.backgroundPosition = (-petFrame * PET_RENDER_SIZE) + "px 0";
    }

    function petClampToHabitat(x, y) {
      var nextX = Math.max(petOriginX - 88, Math.min(Number(x) || petOriginX, petOriginX + 88));
      var nextY = Math.max(petOriginY - 48, Math.min(Number(y) || petOriginY, petOriginY + 48));
      return clampLauncherPosition(nextX, nextY);
    }

    function petMoveTo(x, y) {
      if (!launcher || launcherDragState) return;
      var next = petClampToHabitat(x, y);
      petRoamX = next.x - petOriginX;
      petRoamY = next.y - petOriginY;
      launcher.style.transform = "translate3d(" + petRoamX.toFixed(2) + "px," + petRoamY.toFixed(2) + "px,0)";
    }

    function commitPetRoamPosition() {
      if (!launcher || (!petRoamX && !petRoamY)) return;
      var rect = launcher.getBoundingClientRect();
      launcher.style.transform = "translate3d(0,0,0)";
      launcher.style.left = rect.left + "px";
      launcher.style.top = rect.top + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      petOriginX = rect.left;
      petOriginY = rect.top;
      petRoamX = 0;
      petRoamY = 0;
    }

    function petCanRoam() {
      return Boolean(
        petAssetsReady &&
        launcher &&
        !shellOpen &&
        !petMenuOpen &&
        !petSwitching &&
        !launcherDragState &&
        !petPointerHover &&
        !petHasFocus &&
        !petReducedMotion() &&
        !hostDocument.hidden
      );
    }

    function schedulePetActivity() {
      clearPetActivityTimer();
    }

    function playPetShellAction(name, expectedOpen) {
      var characterAtRequest = petCharacterId;
      var group = petStateMeta(name).group;
      loadPetAsset(characterAtRequest, group).then(function () {
        if (
          petCharacterId === characterAtRequest &&
          shellOpen === expectedOpen &&
          !launcherDragState &&
          !petSwitching
        ) setPetState(name);
      }).catch(function () {});
    }

    function playPetLandingAfterDrag() {
      var landingAsset = petAssetName("landing", petCharacterId);
      if (petReadyAssets.has(landingAsset)) {
        setPetState("landing");
        return;
      }
      setPetState("idle");
    }

    function finishPetState() {
      if (petState === "exit" && petPendingCharacterId) return completePetSwitch();
      if (petState === "enter" || petState === "unique_a" || petState === "unique_b") return setPetState("idle");
      if (petState === "held_scared") return;
      if (petState === "idle") {
        petFrame = 0;
        applyPetFrame();
        schedulePetActivity();
        return;
      }
      setPetState("idle");
    }

    function advancePetFrame() {
      petTimer = 0;
      if (!petSprite || !launcher) return;
      var meta = petStateMeta(petState);
      petFrame += 1;
      if (petFrame > meta.end) {
        petLoops += 1;
        if (petLoops >= meta.loops) {
          finishPetState();
          return;
        }
        petFrame = meta.start;
      }
      applyPetFrame();
      petTimer = host.setTimeout(advancePetFrame, Math.round(1000 / Math.min(16, Math.max(1, meta.fps))));
    }

    function setPetState(name, options) {
      var nextName = String(name || "idle");
      var opts = options || {};
      if (petReducedMotion() && /^(unique_a|unique_b|landing)$/.test(nextName)) nextName = "idle";
      if (nextName !== "idle" && nextName !== "held_scared" && !petReadyAssets.has(petStateAsset(nextName))) nextName = "idle";
      clearPetFrameTimer();
      clearPetActivityTimer();
      clearPetMotionFrame();
      petState = nextName;
      petLoops = 0;
      petSpinAngle = 0;
      var meta = petStateMeta(petState);
      petFrame = meta.start;
      applyPetStateAppearance();
      applyPetFrame();
      if (opts.static || (petReducedMotion() && petState !== "held_scared")) {
        if (petState === "idle") schedulePetActivity();
        return;
      }
      petTimer = host.setTimeout(advancePetFrame, Math.round(1000 / Math.min(16, Math.max(1, meta.fps))));
    }

    function pausePetAutonomy() {
      clearPetFrameTimer();
      clearPetActivityTimer();
      clearPetMotionFrame();
      if (!launcherDragState) setPetState("idle", { static: true });
    }

    function resumePetAutonomy() {
      if (!petAssetsReady || shellOpen || petMenuOpen || petSwitching || hostDocument.hidden || petPointerHover || petHasFocus || launcherDragState) return;
      setPetState("idle");
    }

    function trimPetImageCache() {
      while (petImageCache.size > MAX_DECODED_PET_SHEETS) {
        var removable = "";
        petImageCache.forEach(function (_image, key) {
          var currentPrefix = "v5/" + petCharacterId + "/";
          var pendingPrefix = petPendingCharacterId ? "v5/" + petPendingCharacterId + "/" : "";
          if (!removable && key.indexOf(currentPrefix) !== 0 && (!pendingPrefix || key.indexOf(pendingPrefix) !== 0)) removable = key;
        });
        if (!removable) {
          petImageCache.forEach(function (_image, key) {
            if (
              !removable &&
              key.indexOf("v5/" + petCharacterId + "/") === 0 &&
              key !== petAssetName("idle", petCharacterId) &&
              key !== petAssetName("enter", petCharacterId)
            ) removable = key;
          });
        }
        if (!removable) break;
        petImageCache.delete(removable);
      }
    }

    function startPetLoadTask(task) {
      petLoadsInFlight += 1;
      var image = new host.Image();
      image.decoding = "async";
      var finish = function (error) {
        petLoadsInFlight = Math.max(0, petLoadsInFlight - 1);
        petLoadPromises.delete(task.key);
        if (error) task.reject(error);
        else {
          petImageCache.set(task.key, image);
          if (task.characterId === petCharacterId) petReadyAssets.add(task.key);
          trimPetImageCache();
          task.resolve(image);
        }
        pumpPetLoadQueue();
      };
      image.onload = function () {
        var decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve();
        Promise.resolve(decoded).catch(function () {}).then(function () { finish(); });
      };
      image.onerror = function () { finish(new Error("pet asset failed: " + task.key)); };
      image.src = petAssetUrl(task.key);
    }

    function pumpPetLoadQueue() {
      while (petLoadsInFlight < MAX_PET_LOADS_IN_FLIGHT && petLoadQueue.length) {
        startPetLoadTask(petLoadQueue.shift());
      }
    }

    function loadPetAsset(characterId, group) {
      var key = petAssetName(group, characterId);
      if (petImageCache.has(key)) {
        if (characterId === petCharacterId) petReadyAssets.add(key);
        return Promise.resolve(petImageCache.get(key));
      }
      if (petLoadPromises.has(key)) return petLoadPromises.get(key);
      var promise = new Promise(function (resolve, reject) {
        petLoadQueue.push({ key: key, characterId: characterId, resolve: resolve, reject: reject });
        pumpPetLoadQueue();
      });
      petLoadPromises.set(key, promise);
      return promise;
    }

    function loadPetBackgroundAssets(characterId) {
      var start = function () {
        ["unique-a", "unique-b", "drag", "exit"].forEach(function (group) {
          loadPetAsset(characterId, group).catch(function () {});
        });
      };
      if (host.requestIdleCallback) host.requestIdleCallback(start, { timeout: 1400 });
      else host.setTimeout(start, 260);
    }

    function loadPetAssets() {
      if (!launcher || !petSprite || petAssetsReady) return;
      petReadyAssets.clear();
      Promise.all([
        loadPetAsset(petCharacterId, "idle"),
        loadPetAsset(petCharacterId, "enter"),
        loadPetAsset(petCharacterId, "landing")
      ]).then(function () {
        if (!launcher) return;
        petAssetsReady = true;
        launcher.classList.add("pet-ready");
        launcher.dataset.petCharacter = petCharacterId;
        launcher.setAttribute("aria-label", "打开悬浮手机 · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
        setPetState("enter");
        loadPetBackgroundAssets(petCharacterId);
      }).catch(function () {
        if (launcher) launcher.classList.remove("pet-ready");
      });
    }

    function nextPetCharacterId() {
      var index = PET_CHARACTER_ORDER.indexOf(petCharacterId);
      return PET_CHARACTER_ORDER[(Math.max(0, index) + 1) % PET_CHARACTER_ORDER.length];
    }

    function updatePetCharacterButton() {
      if (!petCharacterButton) return;
      var currentName = PET_CHARACTER_NAMES[petCharacterId] || PET_CHARACTER_NAMES.alisa;
      petCharacterButton.disabled = petSwitching;
      petCharacterButton.textContent = petSwitching ? "人物载入中…" : "人物 · " + currentName;
      petCharacterButton.title = petSwitching ? "正在载入桌宠" : "在信息应用中选择桌宠";
      petCharacterButton.setAttribute("aria-label", petSwitching
        ? "正在载入桌宠"
        : "当前桌宠" + currentName + "；打开桌宠选择");
    }

    function completePetSwitch() {
      var next = petPendingCharacterId;
      if (!next) {
        petSwitching = false;
        updatePetCharacterButton();
        return setPetState("idle");
      }
      petPendingCharacterId = "";
      petCharacterId = next;
      petReadyAssets.clear();
      ["idle", "enter", "landing", "exit"].forEach(function (group) {
        var key = petAssetName(group, petCharacterId);
        if (petImageCache.has(key)) petReadyAssets.add(key);
      });
      petAssetsReady = true;
      petSwitching = false;
      saveUiState();
      updatePetCharacterButton();
      if (launcher) {
        launcher.dataset.petCharacter = petCharacterId;
        launcher.setAttribute("aria-label", "打开悬浮手机 · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
      }
      setPetState("enter");
      loadPetBackgroundAssets(petCharacterId);
    }

    function selectPetCharacter(characterId) {
      var next = textId(characterId);
      if (PET_CHARACTER_ORDER.indexOf(next) < 0) return Promise.reject(new Error("未知桌宠人物"));
      if (petSwitching) return Promise.reject(new Error("桌宠人物正在载入"));
      if (next === petCharacterId) return Promise.resolve(petCharacterId);
      closePetMenu();
      pausePetAutonomy();
      petSwitching = true;
      petPendingCharacterId = next;
      updatePetCharacterButton();
      return Promise.all([
        loadPetAsset(next, "idle"),
        loadPetAsset(next, "enter"),
        loadPetAsset(next, "landing")
      ]).then(function () {
        completePetSwitch();
        updateWandPetEntry();
        return petCharacterId;
      }).catch(function () {
        petSwitching = false;
        petPendingCharacterId = "";
        updatePetCharacterButton();
        resumePetAutonomy();
        throw new Error("桌宠素材载入失败");
      });
    }

    function switchPetCharacter() {
      return selectPetCharacter(nextPetCharacterId());
    }

    function clearPetMenuLongPress() {
      if (petMenuLongPressTimer) host.clearTimeout(petMenuLongPressTimer);
      petMenuLongPressTimer = 0;
    }

    function positionPetMenu() {
      if (!petMenu || !launcher) return;
      var viewport = hostViewportRect();
      var rect = launcher.getBoundingClientRect();
      var left = Math.max(viewport.left + 6, Math.min(rect.left + rect.width / 2 - 60, viewport.left + viewport.width - 126));
      var top = Math.max(viewport.top + 6, Math.min(rect.top - 64, viewport.top + viewport.height - 62));
      petMenu.style.left = left + "px";
      petMenu.style.top = top + "px";
    }

    function openPetMenu(focusMenu) {
      if (!petMenu || !launcher || petSwitching) return;
      if (shellOpen) toggleShell(false);
      pausePetAutonomy();
      commitPetRoamPosition();
      var chooseButton = petMenu.querySelector("[data-pet-action='choose']");
      if (chooseButton) chooseButton.setAttribute("aria-label", "选择桌宠人物");
      positionPetMenu();
      petMenuOpen = true;
      petMenu.classList.add("open");
      petMenu.setAttribute("aria-hidden", "false");
      launcher.setAttribute("aria-expanded", "true");
      if (focusMenu) petMenu.querySelector("button")?.focus();
    }

    function closePetMenu(refocus) {
      clearPetMenuLongPress();
      if (!petMenu) return;
      petMenuOpen = false;
      petMenu.classList.remove("open");
      petMenu.setAttribute("aria-hidden", "true");
      if (launcher) launcher.setAttribute("aria-expanded", shellOpen ? "true" : "false");
      if (refocus && launcher) launcher.focus();
      else if (!launcherDragState && !shellOpen && !petSwitching) resumePetAutonomy();
    }

    function updateWandPetEntry() {
      if (!wandPetEntry || !wandPetEntry.isConnected) return;
      var stored = petDisplayMode === "stored";
      wandPetEntry.style.display = stored ? "" : "none";
      var button = wandPetEntry.querySelector("[data-hypnoos-pet-wand]");
      var preview = wandPetEntry.querySelector("[data-hypnoos-pet-wand-preview]");
      var label = wandPetEntry.querySelector("[data-hypnoos-pet-wand-label]");
      var name = PET_CHARACTER_NAMES[petCharacterId] || petCharacterId;
      if (button) button.setAttribute("aria-label", "打开桌宠手机，当前桌宠" + name);
      if (label) label.textContent = "桌宠 · " + name;
      if (preview) {
        preview.style.backgroundImage = "url('" + petAssetUrl(petAssetName("idle", petCharacterId)).replace(/'/g, "%27") + "')";
      }
    }

    function ensureWandPetEntry() {
      var menu = hostDocument.querySelector("#extensionsMenu");
      if (!menu) return null;
      var container = hostDocument.getElementById("hypnoos-pet-wand-container");
      if (!container) {
        container = hostDocument.createElement("div");
        container.id = "hypnoos-pet-wand-container";
        container.className = "extension_container";
        var button = hostDocument.createElement("div");
        button.className = "list-group-item flex-container flexGap5";
        button.dataset.hypnoosPetWand = "";
        button.tabIndex = 0;
        button.setAttribute("role", "button");
        var preview = hostDocument.createElement("span");
        preview.dataset.hypnoosPetWandPreview = "";
        preview.className = "extensionsMenuExtensionButton";
        preview.style.cssText = "display:inline-block;flex:0 0 24px;width:24px;height:24px;background-repeat:no-repeat;background-position:0 0;background-size:192px 24px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))";
        var label = hostDocument.createElement("span");
        label.dataset.hypnoosPetWandLabel = "";
        button.append(preview, label);
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          menu.style.display = "none";
          toggleShell(true);
        });
        button.addEventListener("keydown", function (event) {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          button.click();
        });
        container.appendChild(button);
      }
      if (container.parentElement !== menu || menu.lastElementChild !== container) menu.appendChild(container);
      wandPetEntry = container;
      updateWandPetEntry();
      return container;
    }

    function applyPetDisplayMode() {
      var stored = petDisplayMode === "stored";
      ensureWandPetEntry();
      if (launcher) {
        launcher.hidden = stored;
        launcher.setAttribute("aria-hidden", stored ? "true" : "false");
      }
      if (stored) {
        closePetMenu();
        pausePetAutonomy();
      } else if (!shellOpen) {
        resumePetAutonomy();
      }
      updateWandPetEntry();
    }

    function setPetDisplayMode(mode) {
      petDisplayMode = mode === "stored" ? "stored" : "floating";
      saveUiState();
      applyPetDisplayMode();
      return readInformationSnapshot();
    }

    function shellCss() {
      return [
        "*{box-sizing:border-box}[hidden]{display:none!important}",
        ".launcher{pointer-events:auto;position:fixed;right:22px;bottom:90px;width:96px;height:96px;border:0;padding:0;border-radius:28px;background:transparent;color:#fff;display:block;cursor:grab;touch-action:none;user-select:none;z-index:3;overflow:visible}",
        ".launcher:focus-visible{outline:3px solid rgba(125,211,252,.96);outline-offset:3px}.launcher.dragging{cursor:grabbing}.pet-sprite{position:absolute;inset:0;width:96px;height:96px;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 7px 5px rgba(2,6,23,.58));transform:translateY(var(--pet-lift,0)) scaleX(var(--pet-facing-scale,1));transform-origin:50% 100%;opacity:0;transition:filter .16s ease}.launcher.pet-ready .pet-sprite{opacity:1}.launcher:hover .pet-sprite,.launcher.active .pet-sprite{filter:drop-shadow(0 8px 5px rgba(30,64,175,.58)) drop-shadow(0 0 5px rgba(125,211,252,.34))}.launcher.dragging .pet-sprite{transition:none;filter:drop-shadow(0 12px 7px rgba(2,6,23,.54))}",
        ".pet-fallback{position:absolute;left:15px;top:15px;width:66px;height:66px;border:1px solid rgba(196,116,255,.7);border-radius:24px;background:linear-gradient(145deg,#58115d,#19142d 62%,#0b1022);box-shadow:0 16px 44px rgba(20,0,35,.48),inset 0 1px rgba(255,255,255,.18);display:grid;place-items:center;transition:opacity .18s ease}.launcher.pet-ready .pet-fallback{opacity:0;pointer-events:none}.pet-fallback svg{width:30px;height:30px}",
".pet-menu{position:fixed;z-index:4;width:120px;height:56px;pointer-events:none;opacity:0;transform:translateY(8px) scale(.9);transform-origin:50% 100%;transition:opacity .14s ease,transform .14s ease}.pet-menu.open{pointer-events:auto;opacity:1;transform:none}.pet-menu button{position:absolute;top:0;width:56px;height:56px;padding:0;border:1px solid rgba(226,232,240,.7);border-radius:50%;background:linear-gradient(145deg,rgba(30,41,59,.97),rgba(15,23,42,.98));box-shadow:0 8px 22px rgba(2,6,23,.48),inset 0 1px rgba(255,255,255,.14);color:#f8fafc;font:850 11px/1.1 system-ui;cursor:pointer;touch-action:manipulation}.pet-menu button[data-pet-action='choose']{left:0}.pet-menu button[data-pet-action='settings']{left:64px}.pet-menu button:hover,.pet-menu button:focus-visible{border-color:#a5f3fc;background:linear-gradient(145deg,#155e75,#172554);outline:2px solid rgba(165,243,252,.72);outline-offset:2px}",
        ".launcher i{position:absolute;z-index:2;right:1px;top:1px;min-width:20px;height:20px;padding:0 5px;border:2px solid rgba(255,255,255,.88);border-radius:10px;background:#f25aa6;color:white;font:800 11px/16px system-ui;text-align:center;box-shadow:0 3px 8px rgba(15,23,42,.46)}@media(prefers-reduced-motion:reduce){.pet-sprite,.pet-fallback{transition:none!important}}",
        ".panel{pointer-events:auto;position:fixed;width:430px;height:812px;border:0;border-radius:38px;background:transparent;box-shadow:none;overflow:visible;z-index:2;display:none;isolation:isolate;--floor-sidecar-width:270px;--phone-scale:1}",
        ".panel.open{display:block}",
".phone-wrap{position:absolute;z-index:4;left:0;top:0;width:430px;height:812px;border:1px solid rgba(221,184,255,.3);border-radius:inherit;background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.42);overflow:hidden;isolation:isolate;transform:scale(var(--phone-scale));transform-origin:0 0}.phone-wrap:after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);pointer-events:none;z-index:8}.phone{display:block;width:430px;height:812px;border:0;background:transparent}",
        ".location-rule-radar{position:absolute;left:50%;top:-112px;width:min(230px,62%);height:160px;object-fit:contain;object-position:center bottom;pointer-events:none;user-select:none;-webkit-user-drag:none;opacity:0;transform:translate3d(-50%,-142px,0) rotate(-5deg) scale(.86);transform-origin:50% 86%;transition:transform .7s cubic-bezier(.16,.92,.2,1.12),opacity .24s ease;will-change:transform,opacity}.location-rule-radar.rear{z-index:3;filter:drop-shadow(0 19px 15px rgba(0,0,0,.64))}.location-rule-radar.front{z-index:6;clip-path:inset(70% 0 0 0);filter:drop-shadow(0 7px 5px rgba(0,0,0,.78))}.panel.location-rule-radar-visible .location-rule-radar{opacity:1;transform:translate3d(-50%,0,0) rotate(0) scale(1)}.panel.location-rule-radar-hiding .location-rule-radar{opacity:0;transform:translate3d(-50%,-154px,0) rotate(4deg) scale(.82);transition-duration:.52s,.2s}@media(max-width:760px){.location-rule-radar{top:-96px;width:min(202px,68%);height:140px}}",
        ".work-lever-host{position:absolute;z-index:8;left:-126px;top:164px;width:126px;height:176px;display:none;pointer-events:none;user-select:none;perspective:440px}.panel.work-lever-visible .work-lever-host{display:block}.work-lever{position:absolute;inset:0;border:0;padding:0;background:transparent;pointer-events:auto;cursor:grab;touch-action:none;overflow:visible}.work-lever:active,.work-lever.is-pulling{cursor:grabbing}.work-lever__body{position:absolute;inset:0;display:block;transform-origin:126px 120px;transform-style:preserve-3d;transform:rotateX(0deg);transition:transform .31s cubic-bezier(.18,.82,.25,1.18),filter .22s ease;filter:drop-shadow(8px 13px 9px rgba(0,0,0,.56))}.work-lever__body svg{position:absolute;inset:0;width:126px;height:150px;overflow:visible}.work-lever__tube-shadow{fill:none;stroke:#080b09;stroke-width:32;stroke-linecap:round;stroke-linejoin:round}.work-lever__tube{fill:none;stroke:url(#workLeverTube);stroke-width:22;stroke-linecap:round;stroke-linejoin:round}.work-lever__tube-shine{fill:none;stroke:rgba(255,255,255,.2);stroke-width:4;stroke-linecap:round;stroke-linejoin:round;transform:translate(-4px,-1px)}.work-lever__knob-ring{fill:#090b0a}.work-lever__knob-core{fill:url(#workLeverKnob)}.work-lever.is-pulling .work-lever__body{transform:rotateX(67deg);filter:drop-shadow(4px 5px 4px rgba(0,0,0,.5)) brightness(1.08);transition-duration:.17s}@media(max-width:760px){.work-lever-host{left:-116px;transform:scale(.92);transform-origin:right top}}",
        ".map-extra-chain-host{position:absolute;z-index:7;right:calc(100% - 18px);top:118px;width:176px;display:none;pointer-events:none;filter:drop-shadow(0 18px 16px rgba(0,0,0,.65));font-family:Impact,'Arial Black','Noto Sans SC',sans-serif;user-select:none}.panel.map-extra-chain-visible .map-extra-chain-host{display:block}.map-extra-chain{display:grid;gap:5px;pointer-events:auto}.map-extra-chain__head{justify-self:end;max-width:160px;padding:7px 9px 7px 12px;border:3px solid #080808;background:#f3eee4;color:#080808;box-shadow:5px 5px 0 #ed1831;font:950 12px/1.1 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.04em;transform:rotate(-2deg);clip-path:polygon(4% 0,100% 5%,94% 100%,0 88%);display:flex;align-items:center;gap:8px}.map-extra-chain__head strong{min-width:0}.map-extra-chain__head button{flex:0 0 27px;width:27px;height:27px;border:2px solid #080808;background:#ed1831;color:#fff;font:950 18px/1 Impact,sans-serif;cursor:pointer;box-shadow:2px 2px 0 #080808}.map-extra-chain__belt{display:grid;gap:2px}.map-extra-chain__row{position:relative;width:160px;margin-left:auto}.map-extra-chain__item{position:relative;width:160px;min-height:47px;border:3px solid #080808;background:#f3eee4;color:#080808;padding:7px 25px 7px 13px;text-align:left;cursor:pointer;pointer-events:auto;box-shadow:5px 4px 0 #ed1831;clip-path:polygon(0 8%,92% 0,100% 48%,92% 100%,0 92%,7% 50%);font:950 12px/1.2 'Arial Black','Noto Sans SC',sans-serif;white-space:normal;overflow-wrap:anywhere;transition:translate .16s ease,filter .16s ease}.map-extra-chain__item:before{content:'';position:absolute;right:9px;top:50%;width:9px;height:9px;border:3px solid #080808;border-radius:50%;background:#ed1831;transform:translateY(-50%)}.map-extra-chain__row:after{content:'';position:absolute;right:12px;top:calc(100% - 1px);width:3px;height:9px;background:#080808}.map-extra-chain__row:last-child:after{display:none}.map-extra-chain__item:hover,.map-extra-chain__item.active{translate:-9px 0;filter:brightness(1.08)}.map-extra-chain__item.active{background:#ed1831;color:#fff;box-shadow:5px 4px 0 #f3eee4}.map-extra-chain__item.favorite{padding-left:29px}.map-extra-chain__item.favorite span:before{content:'★';position:absolute;left:11px;color:#ed1831}.map-extra-chain__delete{position:absolute;z-index:3;right:7px;top:50%;width:25px;height:25px;border:2px solid #080808;background:#ed1831;color:#fff;box-shadow:2px 2px 0 #080808;font:950 17px/1 Impact,sans-serif;cursor:pointer;pointer-events:auto;transform:translateY(-50%) rotate(2deg)}.map-extra-chain__row.deletable .map-extra-chain__item{padding-right:37px}.map-extra-chain__row.deletable .map-extra-chain__item:before{display:none}.map-extra-chain__delete:hover{filter:brightness(1.1);transform:translateY(-50%) rotate(-3deg) scale(1.06)}.map-extra-chain__pager{justify-self:end;display:flex;align-items:center;gap:5px;margin-top:4px;pointer-events:auto}.map-extra-chain__pager button{width:34px;height:30px;border:3px solid #080808;background:#f3eee4;color:#080808;box-shadow:3px 3px 0 #ed1831;font:950 15px/1 Impact,sans-serif;cursor:pointer}.map-extra-chain__pager button:disabled{opacity:.32;cursor:default}.map-extra-chain__pager span{padding:5px 8px;background:#080808;color:#fff;font:950 10px/1 Impact,sans-serif;letter-spacing:.08em}@media(max-width:760px){.map-extra-chain-host{right:calc(100% - 14px);top:112px;width:148px}.map-extra-chain__head,.map-extra-chain__row,.map-extra-chain__item{max-width:136px}.map-extra-chain__item{font-size:10px;min-height:42px}}",
        ".hypnosis-judgement-perch{position:absolute;inset:0;display:none;pointer-events:none;user-select:none;-webkit-user-drag:none}.panel.hypnosis-perch-visible:not(.profile-possession-visible) .hypnosis-judgement-perch{display:block}.hypnosis-judgement-figure{position:absolute;top:76px;bottom:58px;width:152px;pointer-events:none}.hypnosis-judgement-figure.is-demon{right:calc(100% - 14px)}.hypnosis-judgement-figure.is-angel{left:calc(100% - 14px)}.hypnosis-judgement-figure img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}.hypnosis-judgement-figure.is-demon img{object-position:right center}.hypnosis-judgement-figure.is-angel img{object-position:left center}.hypnosis-judgement-figure__rear{z-index:3;filter:drop-shadow(0 18px 13px rgba(0,0,0,.66)) saturate(.86) contrast(1.08)}.hypnosis-judgement-figure__front{z-index:7;filter:drop-shadow(0 5px 3px rgba(0,0,0,.78)) saturate(.9) contrast(1.12)}.hypnosis-judgement-figure.is-demon .hypnosis-judgement-figure__front{clip-path:inset(0 0 0 79%)}.hypnosis-judgement-figure.is-angel .hypnosis-judgement-figure__front{clip-path:inset(0 79% 0 0)}@media(max-width:760px){.hypnosis-judgement-figure{top:92px;bottom:72px;width:118px}.hypnosis-judgement-figure.is-demon{right:calc(100% - 11px)}.hypnosis-judgement-figure.is-angel{left:calc(100% - 11px)}}",
        ".profile-neighbor-host{position:absolute;z-index:2;inset:0;pointer-events:none}.profile-neighbor-rail{--rail-red:#ed1831;position:absolute;top:25%;width:114px;height:48%;min-height:270px;padding:0;border:3px solid #080808;background:#f4efe6;color:#080808;box-shadow:7px 8px 0 var(--rail-red),0 20px 34px rgba(0,0,0,.5);overflow:hidden;cursor:pointer;pointer-events:auto;display:none;isolation:isolate;touch-action:manipulation;transition:transform .28s cubic-bezier(.2,.85,.25,1),filter .2s ease}.panel.profile-neighbors .profile-neighbor-rail{display:block}.profile-neighbor-rail.prev{right:calc(100% - 42px);transform:perspective(420px) rotateY(18deg) rotate(-2deg);clip-path:polygon(0 4%,100% 0,95% 100%,6% 95%)}.profile-neighbor-rail.next{left:calc(100% - 42px);transform:perspective(420px) rotateY(-18deg) rotate(2deg);clip-path:polygon(5% 0,100% 4%,94% 95%,0 100%)}.profile-neighbor-rail:before{content:attr(data-kicker);position:absolute;z-index:3;top:10px;padding:5px 9px;background:#080808;color:#fff;font:950 10px/1 Impact,'Arial Black',sans-serif;letter-spacing:.12em}.profile-neighbor-rail.prev:before{left:8px}.profile-neighbor-rail.next:before{right:8px}.profile-neighbor-rail img,.profile-neighbor-rail__empty{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center 18%;background:#d7d1c8;filter:saturate(.72) contrast(1.08)}.profile-neighbor-rail__empty{display:grid;place-items:center;font:950 38px/1 Impact,sans-serif}.profile-neighbor-rail strong{position:absolute;z-index:3;left:7px;right:7px;bottom:12px;padding:6px 5px;background:#080808;color:#fff;font:950 11px/1.2 'Arial Black','Noto Sans SC',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:3px 3px 0 var(--rail-red)}.profile-neighbor-rail:hover{filter:brightness(1.06)}.profile-neighbor-rail.prev:hover{transform:translateX(-8px) perspective(420px) rotateY(10deg) rotate(-1deg)}.profile-neighbor-rail.next:hover{transform:translateX(8px) perspective(420px) rotateY(-10deg) rotate(1deg)}.panel.profile-neighbors .sidecar{left:calc(100% + 88px)}.panel.profile-turning-prev .profile-neighbor-rail.prev{transform:translateX(26px) scale(1.08) perspective(420px) rotateY(-4deg) rotate(3deg)}.panel.profile-turning-prev .profile-neighbor-rail.next{transform:translateX(8px) scale(.96) perspective(420px) rotateY(-22deg) rotate(2deg)}.panel.profile-turning-next .profile-neighbor-rail.next{transform:translateX(-26px) scale(1.08) perspective(420px) rotateY(4deg) rotate(-3deg)}.panel.profile-turning-next .profile-neighbor-rail.prev{transform:translateX(-8px) scale(.96) perspective(420px) rotateY(22deg) rotate(-2deg)}",
        ".profile-possession-host,.encounter-possession-decor-host{position:absolute;z-index:9;left:50%;top:-88px;width:calc(100% + 34px);height:150px;transform:translateX(-50%) rotate(-.5deg);display:none;pointer-events:none;overflow:visible}.encounter-possession-decor-host[hidden]{display:none!important}.panel.profile-possession-visible .profile-possession-host{display:block}.panel.encounter-possession-decor-visible:not(.profile-possession-visible) .encounter-possession-decor-host:not([hidden]){display:block}.encounter-possession-decor-host img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;clip-path:inset(0 0 18% 0);filter:grayscale(.2) saturate(.82) blur(.55px) drop-shadow(0 8px 8px rgba(0,0,0,.5));opacity:.82;transform:translate(2px,-1px)}.encounter-possession-decor-host:after{content:'';position:absolute;inset:0;background:url('" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "') center/contain no-repeat;clip-path:inset(0 0 18% 0);opacity:.14;filter:blur(4px);transform:translate(-5px,-1px)}.profile-possession-grip{position:absolute;inset:0;border:0;padding:0;background:transparent;pointer-events:auto;cursor:pointer;touch-action:manipulation;clip-path:inset(0 0 18% 0);filter:grayscale(.24) saturate(.76) blur(.7px);opacity:.6;transform:translate(2px,-1px);transition:transform .25s cubic-bezier(.2,.85,.22,1),filter .25s ease,opacity .25s ease}.profile-possession-grip img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}.profile-possession-grip:after{content:'';position:absolute;inset:0;background:url('" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "') center/contain no-repeat;opacity:.2;filter:blur(4px);transform:translate(-6px,-1px);pointer-events:none}.profile-possession-grip:hover{opacity:.8;filter:grayscale(.1) saturate(.9) blur(.35px);transform:translateY(2px) rotate(.25deg)}.profile-possession-grip:active{transform:translateY(4px) scale(.992)}.profile-possession-grip.active{opacity:1;filter:saturate(1.06) contrast(1.04);transform:none}.profile-possession-grip.active:after{opacity:.07;filter:blur(2px);transform:translate(-2px,-1px)}",
        ".encounter-detail-host{--ed-red:#ef1b2d;position:absolute;z-index:18;right:calc(100% + 16px);top:20px;width:500px;max-height:calc(100% - 40px);display:none;overflow:auto;pointer-events:auto;color:#fff;font-family:Impact,'Arial Black','Noto Sans SC',system-ui;filter:drop-shadow(0 28px 45px rgba(0,0,0,.5));scrollbar-width:thin;scrollbar-color:#ef1b2d #080808}.encounter-detail-host.open{display:block}.encounter-detail-host__frame{position:relative;min-height:620px;overflow:hidden;border:5px solid #080808;background:#f3eee4;clip-path:polygon(3% 0,100% 3%,97% 94%,86% 91%,79% 100%,4% 96%,0 12%);isolation:isolate}.encounter-detail-host__frame:before{content:'';position:absolute;inset:-20%;z-index:-3;background:repeating-linear-gradient(113deg,transparent 0 22px,rgba(0,0,0,.08) 23px 25px),radial-gradient(circle at 18% 22%,#ef1b2d 0 3%,transparent 3.3%),linear-gradient(145deg,#eee7dc 0 38%,#d9d1c6 38% 45%,#f7f3ea 45% 100%)}.encounter-detail-host__frame:after{content:'';position:absolute;z-index:-2;left:-18%;right:16%;bottom:-22%;height:66%;background:#080808;transform:rotate(-8deg);clip-path:polygon(0 12%,100% 0,86% 100%,8% 84%)}.encounter-detail-host__close{position:absolute;z-index:8;right:18px;top:18px;width:46px;height:42px;border:4px solid #080808;background:#ef1b2d;color:#fff;font:950 24px/1 Impact,'Arial Black',sans-serif;transform:rotate(3deg);cursor:pointer;box-shadow:6px 6px 0 #080808}.encounter-detail-host__kicker{display:inline-block;margin:28px 0 0 26px;padding:5px 18px;background:#080808;color:#fff;font:950 14px/1 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.12em;transform:rotate(-3deg);clip-path:polygon(4% 0,100% 8%,94% 100%,0 84%)}.encounter-detail-host__name{position:relative;z-index:2;margin:10px 58px 0 24px;color:#080808;font:950 clamp(30px,4vw,54px)/.92 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.02em;text-transform:uppercase;transform:rotate(-2deg);text-shadow:3px 3px 0 #fff,6px 6px 0 #ef1b2d;overflow-wrap:anywhere}.encounter-detail-host__alias{display:inline-block;margin:10px 0 0 32px;padding:5px 13px;background:#ef1b2d;color:#fff;font:900 13px/1.2 system-ui;transform:rotate(1deg)}.encounter-detail-host__visual{position:relative;height:285px;margin:8px 18px 0;overflow:hidden;clip-path:polygon(3% 8%,94% 0,100% 88%,8% 100%,0 55%);background:#080808}.encounter-detail-host__visual img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 18%;filter:saturate(.8) contrast(1.14)}.encounter-detail-host__visual:after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,rgba(239,27,45,.45),transparent 34%,transparent 70%,rgba(0,0,0,.5)),repeating-linear-gradient(0deg,transparent 0 4px,rgba(255,255,255,.07) 5px);mix-blend-mode:screen;pointer-events:none}.encounter-detail-host__source{position:absolute;z-index:4;right:16px;bottom:18px;max-width:70%;padding:7px 13px;background:#fff;color:#080808;border:3px solid #080808;font:950 12px/1.2 system-ui;transform:rotate(-2deg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.encounter-detail-host__body{position:relative;z-index:3;margin:-18px 26px 30px;padding:22px 18px 18px;background:#ef1b2d;color:#fff;clip-path:polygon(0 7%,100% 0,96% 100%,5% 94%);transform:rotate(.5deg)}.encounter-detail-host__intro{margin:0 0 13px;font:750 13px/1.65 system-ui;white-space:pre-wrap}.encounter-detail-host__facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.encounter-detail-host__fact{min-width:0;padding:8px 9px;background:#080808;color:#fff;transform:skew(-4deg)}.encounter-detail-host__fact span{display:block;color:#ff9aa4;font:850 9px/1.2 system-ui;letter-spacing:.08em}.encounter-detail-host__fact strong{display:block;margin-top:3px;font:850 12px/1.3 system-ui;overflow-wrap:anywhere}.encounter-detail-host__thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 27px 28px}.encounter-detail-host__thumbs img{width:100%;aspect-ratio:1/1;object-fit:cover;border:3px solid #080808;background:#ddd;transform:rotate(var(--thumb-tilt,0deg))}.encounter-detail-host__empty{display:grid;height:100%;place-items:center;color:#fff;font:950 54px/1 Impact,sans-serif;background:repeating-linear-gradient(135deg,#080808 0 18px,#ef1b2d 19px 34px)}",
        ".encounter-detail-host{padding:6px 0 16px;overscroll-behavior:contain}.encounter-detail-host__frame{clip-path:polygon(1% 0,100% 1%,99% 98%,87% 97%,82% 100%,1% 99%,0 4%);padding-bottom:30px}.encounter-detail-host__body{margin:-10px 24px 22px;padding:34px 20px 30px;clip-path:polygon(0 2%,100% 0,98% 100%,2% 98%);transform:none}.encounter-detail-host__thumbs{margin-bottom:8px;padding-bottom:8px}",
        ".sidecar{display:none!important}",
        ".readonly{position:static;z-index:13;width:100%;padding:8px 10px;border-radius:13px;background:rgba(39,25,12,.72);border:1px solid rgba(251,191,36,.38);color:#fde68a;font:800 10px/1.35 system-ui;pointer-events:none;display:none;backdrop-filter:blur(10px)}.panel.history .readonly{display:block}",
        ".drag-edge{position:absolute;z-index:9;touch-action:none;user-select:none}.drag-edge.top{left:22px;right:22px;top:0;height:10px;cursor:grab}.drag-edge.bottom{left:22px;right:22px;bottom:0;height:10px;cursor:grab}.drag-edge.left{left:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge.right{right:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge:active,.drag-grip:active{cursor:grabbing}",
        ".resize-corner{position:absolute;z-index:11;bottom:0;width:28px;height:28px;border:0;background:transparent;touch-action:none;user-select:none}.resize-corner.left{left:0;cursor:nesw-resize}.resize-corner.right{right:0;cursor:nwse-resize}",
        ".drag-grip{position:absolute;z-index:10;left:50%;top:4px;width:72px;height:12px;transform:translateX(-50%);border-radius:999px;cursor:grab;touch-action:none;user-select:none}",
        ".floor-toggle,.variable-format-toggle,.pet-character-toggle{position:static;z-index:14;width:128px;min-width:128px;height:36px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;pointer-events:auto;backdrop-filter:blur(12px);font:800 11px/1 system-ui;white-space:nowrap;word-break:keep-all;overflow-wrap:normal;writing-mode:horizontal-tb;text-align:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.18)}",
        ".floor-toggle{border:1px solid rgba(224,188,255,.38);background:rgba(11,8,26,.38);color:#f7eafe}",
        ".variable-format-toggle{border:1px solid rgba(94,234,212,.34);background:rgba(4,47,46,.34);color:#99f6e4}.variable-format-toggle.warn{border-color:rgba(251,113,133,.68);background:rgba(127,29,29,.54);color:#ffe4e6;box-shadow:0 0 0 2px rgba(251,113,133,.14),0 8px 22px rgba(0,0,0,.22)}.variable-format-toggle.missing{border-color:rgba(251,191,36,.48);background:rgba(120,53,15,.42);color:#fde68a}",
        ".pet-character-toggle{border:1px solid rgba(192,132,252,.48);background:linear-gradient(135deg,rgba(88,28,135,.48),rgba(30,41,59,.56));color:#f3e8ff}.pet-character-toggle:hover{border-color:rgba(216,180,254,.72);background:linear-gradient(135deg,rgba(107,33,168,.62),rgba(30,41,59,.68))}.pet-character-toggle:disabled{cursor:wait;opacity:.62}",
        ".resource-panel{width:128px;display:grid;gap:5px;pointer-events:none}.resource-row{min-width:0;height:28px;padding:0 9px;border:1px solid rgba(148,163,184,.27);border-radius:10px;background:rgba(11,8,26,.42);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;gap:6px;color:#dbeafe;font:750 9px/1 system-ui;box-shadow:0 6px 18px rgba(0,0,0,.14)}.resource-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.resource-row strong{flex:0 0 auto;color:#fff;font:900 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.resource-row.money{border-color:rgba(251,191,36,.32);color:#fde68a}.resource-row.starlight{border-color:rgba(244,114,182,.32);color:#fbcfe8}.resource-row.energy{border-color:rgba(56,189,248,.32);color:#bae6fd}.resource-panel.loading .resource-row strong{opacity:.55}",
        ".variable-format-dialog{position:absolute;z-index:31;inset:0;display:none;place-items:center;padding:22px;background:rgba(2,3,10,.7);backdrop-filter:blur(8px);pointer-events:auto}.variable-format-dialog.open{display:grid}.variable-format-dialog__card{width:min(350px,calc(100% - 18px));max-height:calc(100% - 24px);overflow:auto;padding:19px;border:1px solid rgba(94,234,212,.38);border-radius:20px;background:linear-gradient(150deg,rgba(4,47,46,.98),rgba(10,14,31,.99) 66%);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#ecfeff;font-family:system-ui}.variable-format-dialog__card.warn{border-color:rgba(251,113,133,.56);background:linear-gradient(150deg,rgba(76,5,25,.98),rgba(10,14,31,.99) 66%)}.variable-format-dialog__card strong{display:block;font:850 18px/1.3 system-ui}.variable-format-dialog__card p{margin:10px 0;color:rgba(236,254,255,.8);font:650 12px/1.6 system-ui;white-space:pre-wrap;overflow-wrap:anywhere}.variable-format-dialog__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.variable-format-dialog__actions button{height:40px;border:1px solid rgba(153,246,228,.34);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font:800 12px system-ui;cursor:pointer}.variable-format-dialog__actions button[data-variable-format-repair]{border-color:rgba(251,113,133,.48);background:rgba(159,18,57,.28)}.variable-format-dialog__actions button:disabled{opacity:.45;cursor:not-allowed}",
        ".floor-drawer{position:static;z-index:12;width:100%;display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0;border:0;border-radius:17px;background:transparent;backdrop-filter:none;box-shadow:none;color:#f8efff;pointer-events:auto}",
        ".floor-drawer.open{display:grid}.floor-title{grid-column:1/2;align-self:center;overflow:hidden;color:#d9cbe4;font:750 11px/1.2 system-ui;text-overflow:ellipsis;white-space:nowrap}",
        ".select{grid-column:1/-1;width:100%;height:38px;border:1px solid rgba(201,155,232,.34);border-radius:11px;background:rgba(24,21,43,.72);backdrop-filter:blur(10px);color:#f7effc;padding:0 31px 0 10px;font:700 11px system-ui}",
        ".mode{height:32px;padding:0 10px;border:1px solid rgba(201,155,232,.34);border-radius:10px;background:rgba(24,21,43,.5);backdrop-filter:blur(10px);color:#efe4f8;font:750 10px system-ui;cursor:pointer}",
        ".badge{grid-column:1/-1;min-height:28px;padding:6px 9px;border-radius:9px;display:flex;align-items:center;background:rgba(19,78,59,.32);backdrop-filter:blur(10px);border:1px solid rgba(51,211,153,.32);color:#a7f3d0;font:800 10px/1.25 system-ui}.badge.history{background:rgba(76,48,13,.34);border-color:rgba(251,191,36,.3);color:#fde68a}",
        "@media(max-width:980px){.encounter-detail-host{position:fixed;left:8px;right:auto;top:8px;width:min(440px,calc(100vw - 16px));max-height:calc(100vh - 16px)}}",
        "@media(max-width:760px){.profile-neighbor-rail{width:84px;min-height:220px}.profile-neighbor-rail.prev{right:calc(100% - 34px)}.profile-neighbor-rail.next{left:calc(100% - 34px)}.floor-drawer{grid-template-columns:minmax(0,1fr)}.floor-title,.mode,.select,.badge{grid-column:1/-1;width:100%}.encounter-detail-host__frame{min-height:560px}}"
      ].join("");
    }

    function hideEncounterDetail() {
      if (!encounterDetailHost) return;
      encounterDetailHost.classList.remove("open");
      encounterDetailHost.setAttribute("aria-hidden", "true");
      encounterDetailHost.innerHTML = "";
    }

    function updateProfileNeighbors(payload) {
      ensureShell();
      if (!panel || !profileNeighborHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var visible = Boolean(data && data.visible && data.prev && data.next);
      panel.classList.toggle("profile-neighbors", visible);
      ["prev", "next"].forEach(function (direction) {
        var button = profileNeighborHost.querySelector("[data-profile-neighbor='" + direction + "']");
        if (!button) return;
        var item = visible && data[direction] && typeof data[direction] === "object" ? data[direction] : {};
        var name = textId(item.name);
        var photo = textId(item.photo);
        var signature = name + "\u0001" + photo;
        button.setAttribute("aria-label", (direction === "prev" ? "上一个角色：" : "下一个角色：") + (name || "未命名角色"));
        if (button.dataset.signature === signature) return;
        button.dataset.signature = signature;
        button.innerHTML = (photo
          ? "<img alt='' decoding='async' src='" + escapeHtml(photo) + "'>"
          : "<span class='profile-neighbor-rail__empty' aria-hidden='true'>" + escapeHtml((name || "?").slice(0, 1)) + "</span>") +
          "<strong>" + escapeHtml(name || "未命名角色") + "</strong>";
      });
      if (visible) applySavedPosition();
      return visible;
    }

    function updateProfilePossession(payload) {
      ensureShell();
      if (!panel || !profilePossessionHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var roleName = textId(data && data.roleName);
      var visible = Boolean(data && data.visible && roleName);
      var active = Boolean(visible && data.active);
      var label = textId(data && data.label) || (active ? "解除附身" : "附身");
      panel.classList.toggle("profile-possession-visible", visible);
      var button = profilePossessionHost.querySelector("[data-profile-possession-host]");
      if (!button) return false;
      button.dataset.profilePossessionHost = visible ? roleName : "";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("aria-label", visible ? label + "：" + roleName : "附身");
      if (visible) applySavedPosition();
      return visible;
    }

    function updateEncounterPossessionDecor(payload) {
      ensureShell();
      if (!panel || !encounterPossessionDecorHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var roleName = textId(data && data.roleName);
      var visible = Boolean(data && data.visible && roleName);
      panel.classList.toggle("encounter-possession-decor-visible", visible);
      encounterPossessionDecorHost.hidden = !visible;
      encounterPossessionDecorHost.dataset.roleName = visible ? roleName : "";
      encounterPossessionDecorHost.setAttribute("aria-hidden", visible ? "false" : "true");
      if (visible) applySavedPosition();
      return visible;
    }

    function updateHypnosisPerch(payload) {
      ensureShell();
      if (!panel) return false;
      var visible = payload === true || Boolean(payload && typeof payload === "object" && payload.visible);
      panel.classList.toggle("hypnosis-perch-visible", visible);
      return visible;
    }

    function updateWorkLever(payload) {
      ensureShell();
      if (!panel || !workLeverHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var visible = Boolean(data && data.visible);
      var pulling = Boolean(visible && data.pulling);
      var axisY = Number(data && data.axisY);
      panel.classList.toggle("work-lever-visible", visible);
      if (visible && Number.isFinite(axisY)) {
        workLeverHost.style.top = Math.max(18, axisY - 120) + "px";
      }
      var button = workLeverHost.querySelector("[data-work-lever-host]");
      if (button) {
        button.classList.toggle("is-pulling", pulling);
        button.setAttribute("aria-hidden", visible ? "false" : "true");
      }
      if (!visible) workLeverPointer = null;
      if (visible) applySavedPosition();
      return visible;
    }

    function updateMapExtraChain(payload) {
      ensureShell();
      if (!panel || !mapExtraChainHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var visible = Boolean(data && data.visible);
      panel.classList.toggle("map-extra-chain-visible", visible);
      if (!visible) {
        mapExtraChainHost.innerHTML = "";
        mapExtraChainHost.setAttribute("aria-hidden", "true");
        return false;
      }
      var items = Array.isArray(data.items) ? data.items.slice(0, 6) : [];
      var page = Math.max(0, Number(data.page) || 0);
      var pageCount = Math.max(1, Number(data.pageCount) || 1);
      var itemHtml = items.map(function (item) {
        var id = textId(item && item.id);
        var label = textId(item && item.label) || id || "未命名地点";
        var classes = ["map-extra-chain__item"];
        if (item && item.active) classes.push("active");
        if (item && item.favorite) classes.push("favorite");
        var deletable = Boolean(item && item.deletable);
        return "<div class='map-extra-chain__row" + (deletable ? " deletable" : "") + "'>" +
          "<button type='button' class='" + classes.join(" ") + "' data-map-extra-id='" + escapeHtml(id) + "'><span>" + escapeHtml(label) + "</span></button>" +
          (deletable ? "<button type='button' class='map-extra-chain__delete' data-map-extra-delete='" + escapeHtml(id) + "' aria-label='删除新增地点'>×</button>" : "") +
        "</div>";
      }).join("");
      mapExtraChainHost.innerHTML =
        "<section class='map-extra-chain'>" +
          "<div class='map-extra-chain__head'><strong>" + escapeHtml(textId(data.title) || "更多区域") + "</strong>" + (data.canAdd ? "<button type='button' data-map-extra-add aria-label='新增地点'>＋</button>" : "") + "</div>" +
          "<div class='map-extra-chain__belt'>" + itemHtml + "</div>" +
          "<div class='map-extra-chain__pager'><button type='button' data-map-extra-page='prev' aria-label='上一页'" + (pageCount <= 1 ? " disabled" : "") + ">‹</button><span>" + (page + 1) + " / " + pageCount + "</span><button type='button' data-map-extra-page='next' aria-label='下一页'" + (pageCount <= 1 ? " disabled" : "") + ">›</button></div>" +
        "</section>";
      mapExtraChainHost.setAttribute("aria-hidden", "false");
      mapExtraChainHost.querySelectorAll("[data-map-extra-id]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_SELECT__", [button.getAttribute("data-map-extra-id") || ""], false);
        });
      });
      mapExtraChainHost.querySelectorAll("[data-map-extra-page]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_PAGE__", [button.getAttribute("data-map-extra-page") || "next"], false);
        });
      });
      mapExtraChainHost.querySelectorAll("[data-map-extra-delete]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_DELETE__", [button.getAttribute("data-map-extra-delete") || ""], false);
        });
      });
      mapExtraChainHost.querySelector("[data-map-extra-add]")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        phoneApi("__ST_HYPNOOS_MAP_EXTRA_ADD__", [], false);
      });
      applySavedPosition();
      return true;
    }

    function updateLocationRuleRadar(payload) {
      ensureShell();
      if (!panel) return false;
      var data = payload && typeof payload === "object" ? payload : {};
      var visible = Boolean(data.visible);
      var immediate = Boolean(data.immediate);
      if (locationRuleRadarTimer) {
        host.clearTimeout(locationRuleRadarTimer);
        locationRuleRadarTimer = 0;
      }
      if (visible) {
        panel.classList.remove("location-rule-radar-hiding");
        panel.classList.remove("location-rule-radar-visible");
        host.requestAnimationFrame(function () {
          if (panel) panel.classList.add("location-rule-radar-visible");
        });
        applySavedPosition();
        return true;
      }
      panel.classList.remove("location-rule-radar-visible");
      if (immediate) {
        panel.classList.remove("location-rule-radar-hiding");
        return false;
      }
      panel.classList.add("location-rule-radar-hiding");
      locationRuleRadarTimer = host.setTimeout(function () {
        locationRuleRadarTimer = 0;
        if (panel) panel.classList.remove("location-rule-radar-hiding");
      }, 560);
      return false;
    }

    function showEncounterDetail(payload) {
      ensureShell();
      if (!encounterDetailHost) return false;
      var data = payload && typeof payload === "object" ? payload : {};
      var name = textId(data.name) || "未命名角色";
      var alias = textId(data.alias);
      var source = textId(data.source) || "角色库";
      var intro = textId(data.intro) || "暂无角色介绍。";
      var images = Array.isArray(data.images) ? data.images.map(textId).filter(Boolean).slice(0, 4) : [];
      var facts = Array.isArray(data.facts) ? data.facts.filter(function (item) {
        return item && typeof item === "object" && textId(item.value);
      }).slice(0, 10) : [];
      var hero = images[0]
        ? "<img src='" + escapeHtml(images[0]) + "' alt='" + escapeHtml(name) + "'>"
        : "<span class='encounter-detail-host__empty'>" + escapeHtml(name.slice(0, 1)) + "</span>";
      var factHtml = facts.map(function (item) {
        return "<div class='encounter-detail-host__fact'><span>" + escapeHtml(textId(item.label) || "资料") + "</span><strong>" + escapeHtml(textId(item.value)) + "</strong></div>";
      }).join("");
      var thumbs = images.length > 1
        ? "<div class='encounter-detail-host__thumbs'>" + images.map(function (image, index) {
            return "<img src='" + escapeHtml(image) + "' alt='" + escapeHtml(name + " 图片" + (index + 1)) + "' style='--thumb-tilt:" + (index % 2 ? "2deg" : "-2deg") + "'>";
          }).join("") + "</div>"
        : "";
      encounterDetailHost.innerHTML =
        "<section class='encounter-detail-host__frame' role='dialog' aria-modal='false' aria-label='" + escapeHtml(name + " 详情") + "'>" +
          "<button class='encounter-detail-host__close' type='button' aria-label='关闭角色详情'>×</button>" +
          "<span class='encounter-detail-host__kicker'>PERSONA FILE</span>" +
          "<h2 class='encounter-detail-host__name'>" + escapeHtml(name) + "</h2>" +
          (alias ? "<span class='encounter-detail-host__alias'>" + escapeHtml(alias) + "</span>" : "") +
          "<div class='encounter-detail-host__visual'>" + hero + "<span class='encounter-detail-host__source'>" + escapeHtml(source) + "</span></div>" +
          "<div class='encounter-detail-host__body'><p class='encounter-detail-host__intro'>" + escapeHtml(intro) + "</p><div class='encounter-detail-host__facts'>" + factHtml + "</div></div>" +
          thumbs +
        "</section>";
      encounterDetailHost.scrollTop = 0;
      encounterDetailHost.querySelector(".encounter-detail-host__close")?.addEventListener("click", hideEncounterDetail);
      encounterDetailHost.classList.add("open");
      encounterDetailHost.setAttribute("aria-hidden", "false");
      if (panel && host.innerWidth > 980) {
        var desiredWidth = Math.max(320, Math.min(520, host.innerWidth - panel.offsetWidth - panelSidecarReserve(panel.offsetWidth) - 44));
        encounterDetailHost.style.width = desiredWidth + "px";
        var rect = panel.getBoundingClientRect();
        if (rect.left < desiredWidth + 24) {
          var next = clampPosition(desiredWidth + 24, rect.top);
          panel.style.left = next.x + "px";
          panel.style.top = next.y + "px";
        }
      } else {
        encounterDetailHost.style.removeProperty("width");
      }
      return true;
    }

    function bridgePrelude() {
      var asset = JSON.stringify(config.assetBase);
      var singletonKey = JSON.stringify(config.singletonKey);
      return "<script>(function(){var r=parent[" + singletonKey + "];window.__ST_HYPNOOS_FLOATING_PHONE__=true;window.__ST_HYPNOOS_FLOATING_REGISTRY__=r;window.__ST_HYPNOOS_ASSET_BASE__=" + asset + ";" +
        "function option(o){return r.normalizeMessageOption(o)}function writeOption(o){return r.normalizeWriteMessageOption(o)}" +
        "globalThis.getCurrentMessageId=function(){return r.getSelectedId()};" +
        "globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__=function(){if(r.isWritable())return true;r.notifyReadOnly();return false};" +
        "if(r.hasApi('getVariables'))globalThis.getVariables=function(o){return r.readApi('getVariables',[option(o)])};" +
        "if(r.hasApi('updateVariablesWith'))globalThis.updateVariablesWith=function(fn,o){return r.guardedApi('updateVariablesWith',[fn,writeOption(o)])};" +
        "if(r.hasApi('getChatMessages'))globalThis.getChatMessages=function(){return r.callApi('getChatMessages',Array.prototype.slice.call(arguments))||[]};" +
        "if(r.hasApi('setChatMessages'))globalThis.setChatMessages=function(){return r.guardedApi('setChatMessages',Array.prototype.slice.call(arguments))};" +
        "globalThis.getContext=function(){return r.getContext()};" +
        "globalThis.__ST_HYPNOOS_HOST_REQUEST_HEADERS__=function(){return r.getRequestHeaders()};" +
        "globalThis.__ST_HYPNOOS_DIRECT_SEND__=function(t){return r.directSend(t)};" +
        "globalThis.__ST_HYPNOOS_READ_INFORMATION__=function(){return r.readInformation()};" +
        "globalThis.__ST_HYPNOOS_SELECT_INFORMATION_FLOOR__=function(id){return r.selectInformationFloor(id)};" +
        "globalThis.__ST_HYPNOOS_TOGGLE_INFORMATION_MODE__=function(){return r.toggleInformationMode()};" +
        "globalThis.__ST_HYPNOOS_SWITCH_INFORMATION_PET__=function(){return r.switchInformationPet()};" +
        "globalThis.__ST_HYPNOOS_SELECT_INFORMATION_PET__=function(id){return r.selectInformationPet(id)};" +
        "globalThis.__ST_HYPNOOS_TOGGLE_INFORMATION_PET_MODE__=function(){return r.toggleInformationPetMode()};" +
        "globalThis.__ST_HYPNOOS_UPDATE_PROFILE_NEIGHBORS__=function(p){return r.updateProfileNeighbors(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_PROFILE_POSSESSION__=function(p){return r.updateProfilePossession(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_ENCOUNTER_POSSESSION_DECOR__=function(p){return r.updateEncounterPossessionDecor(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_HYPNOSIS_PERCH__=function(p){return r.updateHypnosisPerch(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_WORK_LEVER__=function(p){return r.updateWorkLever(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_MAP_EXTRA_CHAIN__=function(p){return r.updateMapExtraChain(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_LOCATION_RULE_RADAR__=function(p){return r.updateLocationRuleRadar(p)};" +
        "globalThis.SillyTavern={getContext:function(){return r.getContext()},getCurrentChatId:function(){return r.getCurrentChatId()}};" +
        "var sourceMvu=r.getMvu();if(sourceMvu&&typeof sourceMvu.getMvuData==='function'&&typeof sourceMvu.replaceMvuData==='function'){globalThis.Mvu={get events(){return sourceMvu.events||{}},getMvuData:function(o){return r.readMvu('getMvuData',[option(o)])},replaceMvuData:function(m,o){return r.guardedMvu('replaceMvuData',[m,writeOption(o)])}};if(typeof sourceMvu.setMvuVariable==='function')globalThis.Mvu.setMvuVariable=function(){return r.guardedMvu('setMvuVariable',Array.prototype.slice.call(arguments))}}" +
        "['eventOn','triggerSlash','getWorldbookNames','getCharWorldbookNames','getWorldbook','generateRaw'].forEach(function(n){if(r.hasApi(n))globalThis[n]=function(){return r.callApi(n,Array.prototype.slice.call(arguments))}});" +
        "['createWorldbook','createWorldbookEntries','createWorldInfoEntry','replaceWorldbook','updateWorldbookWith','rebindCharWorldbooks','deleteWorldbook'].forEach(function(n){if(r.hasApi(n))globalThis[n]=function(){return r.guardedApi(n,Array.prototype.slice.call(arguments))}});" +
        "})();</scr" + "ipt>";
    }

    function mountPhone(force) {
      ensureShell();
      var currentWritable = writableId();
      if (!frame || (!force && frame.dataset.loadedFor === currentWritable)) return;
      if (!config.frontendUrl) return;
      updateProfileNeighbors(null);
      updateHypnosisPerch(null);
      updateWorkLever(null);
      updateMapExtraChain(null);
      updateLocationRuleRadar({ visible: false, immediate: true });
      frame.dataset.loadedFor = currentWritable;
      loadedForWritableId = currentWritable;
      try { fetchController?.abort?.(); } catch (_) {}
      fetchController = typeof host.AbortController === "function" ? new host.AbortController() : null;
      frame.removeAttribute("src");
      frame.srcdoc = "<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;min-height:100%;background:transparent}</style></head><body><main style='min-height:100vh;display:grid;place-items:center;background:#090b16;color:#dbc8e8;font:700 14px system-ui'>正在连接楼层变量…</main></body></html>";
      host.fetch(config.frontendUrl, { cache: "no-store", signal: fetchController && fetchController.signal }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).then(function (html) {
        if (loadedForWritableId !== currentWritable) return;
        if (config.vendorBase) html = html.replaceAll("/public/vendor/", String(config.vendorBase).replace(/\/?$/, "/"));
        var bridge = bridgePrelude();
        var next = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, "<head$1>" + bridge) : bridge + html;
        frame.srcdoc = next;
      }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        frame.srcdoc = "<!doctype html><html><body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#090b16;color:#fca5a5;font:700 14px/1.7 system-ui;padding:24px;text-align:center'>悬浮手机加载失败<br>" + escapeHtml(error && error.message) + "</body></html>";
      });
    }

    function scheduleMount(force) {
      if (mountTimer) host.clearTimeout(mountTimer);
      mountTimer = host.setTimeout(function () {
        mountTimer = 0;
        mountPhone(Boolean(force));
      }, 80);
    }

    function ensureShell() {
      if (shell && shell.isConnected) return;
      loadUiState();
      shell = hostDocument.createElement("div");
      shell.id = config.hostId;
      shell.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147481900;";
      shadow = shell.attachShadow({ mode: "open" });
      shadow.innerHTML = "<style>" + shellCss() + "</style>" +
        "<button class='launcher' type='button' aria-label='打开悬浮手机' aria-haspopup='menu' aria-expanded='false'><span class='pet-sprite' aria-hidden='true'></span><span class='pet-fallback' aria-hidden='true'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><rect x='6' y='2.5' width='12' height='19' rx='3'/><path d='M10 5h4M11 18.5h2'/></svg></span><i>0</i></button>" +
"<nav class='pet-menu' role='menu' aria-label='桌宠菜单' aria-hidden='true'><button type='button' role='menuitem' data-pet-action='choose'>选择</button><button type='button' role='menuitem' data-pet-action='settings'>通用</button></nav>" +
        "<section class='panel' aria-label='HypnoOS 悬浮手机'><aside class='map-extra-chain-host' aria-label='更多地图区域' aria-hidden='true'></aside><aside class='work-lever-host' aria-label='打工滚筒摇杆'><button class='work-lever' type='button' data-work-lever-host aria-label='拉动或点击摇杆切换下一份工作'><span class='work-lever__body'><svg viewBox='0 0 126 150' aria-hidden='true'><defs><linearGradient id='workLeverTube' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#aeb8b1'/><stop offset='.42' stop-color='#647169'/><stop offset='.72' stop-color='#303a34'/><stop offset='1' stop-color='#151b17'/></linearGradient><radialGradient id='workLeverKnob' cx='.32' cy='.25' r='.72'><stop offset='0' stop-color='#ffd36b'/><stop offset='.22' stop-color='#df850d'/><stop offset='.68' stop-color='#91340b'/><stop offset='1' stop-color='#431506'/></radialGradient></defs><path class='work-lever__tube-shadow' d='M44 31V101Q44 120 63 120H126'/><path class='work-lever__tube' d='M44 31V101Q44 120 63 120H126'/><path class='work-lever__tube-shine' d='M44 35V99Q44 113 61 113H122'/><circle class='work-lever__knob-ring' cx='44' cy='28' r='33'/><circle class='work-lever__knob-core' cx='44' cy='28' r='27'/></svg></span></button></aside><aside class='hypnosis-judgement-perch' aria-hidden='true'><span class='hypnosis-judgement-figure is-demon'><img class='hypnosis-judgement-figure__rear' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-demon-side-v3.png") + "'><img class='hypnosis-judgement-figure__front' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-demon-side-v3.png") + "'></span><span class='hypnosis-judgement-figure is-angel'><img class='hypnosis-judgement-figure__rear' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-angel-side-v3.png") + "'><img class='hypnosis-judgement-figure__front' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-angel-side-v3.png") + "'></span></aside><aside class='encounter-detail-host' aria-hidden='true'></aside><aside class='profile-neighbor-host' aria-label='相邻人物档案'><button class='profile-neighbor-rail prev' type='button' data-kicker='PREV' data-profile-neighbor='prev'></button><button class='profile-neighbor-rail next' type='button' data-kicker='NEXT' data-profile-neighbor='next'></button></aside><aside class='encounter-possession-decor-host' aria-hidden='true' hidden><img alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "'></aside><aside class='profile-possession-host' aria-label='附身控制'><button class='profile-possession-grip' type='button' data-profile-possession-host='' aria-pressed='false'><img alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "'></button></aside><div class='phone-wrap'><iframe class='phone' title='HypnoOS 手机前端' scrolling='no'></iframe><div class='variable-format-dialog' role='dialog' aria-modal='true' aria-hidden='true'><section class='variable-format-dialog__card'><strong data-variable-format-title>变量格式检查</strong><p data-variable-format-body></p><div class='variable-format-dialog__actions'><button type='button' data-variable-format-close>关闭</button><button type='button' data-variable-format-repair>清理并补齐</button></div></section></div></div><span class='drag-edge top' data-phone-drag></span><span class='drag-edge right' data-phone-drag></span><span class='drag-edge bottom' data-phone-drag></span><span class='drag-edge left' data-phone-drag></span><span class='drag-grip' data-phone-drag aria-label='拖动手机'></span><span class='resize-corner left' data-phone-resize='left'></span><span class='resize-corner right' data-phone-resize='right'></span><aside class='sidecar'><section class='resource-panel loading' aria-label='当前楼层资源'><div class='resource-row money'><span>零花钱</span><strong data-resource-money>--</strong></div><div class='resource-row starlight'><span>星光点</span><strong data-resource-starlight>--</strong></div><div class='resource-row energy'><span>MC能量</span><strong data-resource-energy>--</strong></div></section><button class='variable-format-toggle' type='button'>变量格式检查</button><span class='readonly'>历史楼层 · 只读；切回当前楼后才能操作</span><button class='pet-character-toggle' type='button'>人物 · 爱丽莎</button><button class='floor-toggle' type='button' aria-expanded='false'>楼层</button><section class='floor-drawer'><span class='floor-title'></span><button class='mode' type='button'>跟随视口</button><select class='select' aria-label='选择变量楼层'></select><span class='badge'></span></section></aside></section>";
      hostDocument.body.appendChild(shell);
      launcher = shadow.querySelector(".launcher");
      petSprite = shadow.querySelector(".pet-sprite");
      petMenu = shadow.querySelector(".pet-menu");
      ensureWandPetEntry();
      if (!wandObserver && typeof host.MutationObserver === "function") {
        wandObserver = new host.MutationObserver(function () {
          var menu = hostDocument.querySelector("#extensionsMenu");
          if (!wandPetEntry || !wandPetEntry.isConnected || (menu && menu.lastElementChild !== wandPetEntry)) ensureWandPetEntry();
        });
        wandObserver.observe(hostDocument.body, { childList: true, subtree: true });
      }
      panel = shadow.querySelector(".panel");
      if (panel && !panel.querySelector(".location-rule-radar")) {
        ["rear", "front"].forEach(function (layer) {
          var radar = hostDocument.createElement("img");
          radar.className = "location-rule-radar " + layer;
          radar.alt = "";
          radar.draggable = false;
          radar.src = String(config.assetBase || "").replace(/\/?$/, "/") + "maps/location-rule-radar-v2.png";
          panel.insertBefore(radar, panel.querySelector(".phone-wrap"));
        });
      }
      frame = shadow.querySelector(".phone");
      floorSelect = shadow.querySelector(".select");
      modeButton = shadow.querySelector(".mode");
      stateBadge = shadow.querySelector(".badge");
      titleFloor = shadow.querySelector(".floor-title");
	      resourcePanel = shadow.querySelector(".resource-panel");
	      variableFormatButton = shadow.querySelector(".variable-format-toggle");
	      petCharacterButton = shadow.querySelector(".pet-character-toggle");
	      variableFormatDialog = shadow.querySelector(".variable-format-dialog");
      encounterDetailHost = shadow.querySelector(".encounter-detail-host");
      encounterPossessionDecorHost = shadow.querySelector(".encounter-possession-decor-host");
      profileNeighborHost = shadow.querySelector(".profile-neighbor-host");
      profilePossessionHost = shadow.querySelector(".profile-possession-host");
      workLeverHost = shadow.querySelector(".work-lever-host");
      mapExtraChainHost = shadow.querySelector(".map-extra-chain-host");
      var workLeverButton = workLeverHost && workLeverHost.querySelector("[data-work-lever-host]");
      if (workLeverButton) {
        workLeverButton.addEventListener("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
          workLeverPointer = { id: event.pointerId, y: event.clientY, fired: false };
          try { workLeverButton.setPointerCapture(event.pointerId); } catch (_) {}
          workLeverButton.classList.add("is-pulling");
        });
        workLeverButton.addEventListener("pointermove", function (event) {
          if (!workLeverPointer || workLeverPointer.id !== event.pointerId || workLeverPointer.fired) return;
          if (event.clientY - workLeverPointer.y < 28) return;
          workLeverPointer.fired = true;
          phoneApi("__ST_HYPNOOS_WORK_LEVER_PULL__", ["next"], false);
        });
        var releaseWorkLever = function (event) {
          if (!workLeverPointer || workLeverPointer.id !== event.pointerId) return;
          var shouldFire = !workLeverPointer.fired;
          workLeverPointer = null;
          if (shouldFire) phoneApi("__ST_HYPNOOS_WORK_LEVER_PULL__", ["next"], false);
          host.setTimeout(function () { workLeverButton.classList.remove("is-pulling"); }, 170);
          try { workLeverButton.releasePointerCapture(event.pointerId); } catch (_) {}
        };
        var cancelWorkLever = function (event) {
          if (!workLeverPointer || workLeverPointer.id !== event.pointerId) return;
          workLeverPointer = null;
          host.setTimeout(function () { workLeverButton.classList.remove("is-pulling"); }, 90);
          try { workLeverButton.releasePointerCapture(event.pointerId); } catch (_) {}
        };
        workLeverButton.addEventListener("pointerup", releaseWorkLever);
        workLeverButton.addEventListener("pointercancel", cancelWorkLever);
        workLeverButton.addEventListener("click", function (event) {
          if (event.detail !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_WORK_LEVER_PULL__", ["next"], false);
        });
      }
      profileNeighborHost?.querySelectorAll("[data-profile-neighbor]")?.forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var direction = button.getAttribute("data-profile-neighbor") === "prev" ? "prev" : "next";
          panel.classList.remove("profile-turning-prev", "profile-turning-next");
          panel.classList.add("profile-turning-" + direction);
          phoneApi("__ST_HYPNOOS_PROFILE_NAV__", [direction], false);
          host.setTimeout(function () { panel?.classList?.remove("profile-turning-prev", "profile-turning-next"); }, 430);
        });
      });
      profilePossessionHost?.querySelector("[data-profile-possession-host]")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var button = event.currentTarget;
        var roleName = textId(button && button.dataset && button.dataset.profilePossessionHost);
        if (!roleName) return;
        phoneApi("__ST_HYPNOOS_PROFILE_POSSESSION__", [roleName], false);
      });
	      variableFormatDialog?.querySelector("[data-variable-format-close]")?.addEventListener("click", closeVariableFormatDialog);
	      variableFormatDialog?.querySelector("[data-variable-format-repair]")?.addEventListener("click", async function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        var button = event.currentTarget;
	        if (!isWritable()) {
	          openVariableFormatDialog();
	          return;
	        }
	        button.disabled = true;
	        button.textContent = "正在矫正…";
	        var result = await Promise.resolve(phoneApi("__ST_HYPNOOS_CORRECT_VARIABLE_FORMAT__", [], false));
	        refreshVariableFormatCheck();
	        openVariableFormatDialog();
	        var body = variableFormatDialog && variableFormatDialog.querySelector("[data-variable-format-body]");
	        if (body && result && result.ok) {
	          body.textContent = "变量格式已矫正：补齐 " + (result.missingCount || 0) + " 项，清理未知键 " + (result.removedExtraCount || 0) + " 项。";
	        } else if (body) {
	          body.textContent = "变量格式矫正失败：" + String(result && result.reason || "未能写回当前楼变量。");
	        }
	      });
	      variableFormatButton?.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        openVariableFormatDialog();
	      });
	      petCharacterButton?.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        toggleShell(true);
	        host.setTimeout(function () { phoneApi("__ST_OPEN_INFORMATION_APP__", [], false); }, 0);
	      });
	      updatePetCharacterButton();
      applyPetDisplayMode();
      launcher.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (suppressLauncherClick) {
          suppressLauncherClick = false;
          return;
        }
        if (petMenuOpen) {
          closePetMenu();
          return;
        }
        toggleShell(!shellOpen);
      });
      launcher.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openPetMenu(false);
      });
      launcher.addEventListener("keydown", function (event) {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          event.stopPropagation();
          openPetMenu(true);
        } else if (event.key === "Escape" && petMenuOpen) {
          event.preventDefault();
          closePetMenu(true);
        }
      });
      petMenu?.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-pet-action]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        var action = button.getAttribute("data-pet-action");
        if (action === "choose") {
          closePetMenu();
          toggleShell(true);
          host.setTimeout(function () { phoneApi("__ST_OPEN_INFORMATION_APP__", [], false); }, 0);
        } else if (action === "settings") {
          closePetMenu();
          host.dispatchEvent(new host.CustomEvent("hypnoos3-open-settings"));
        }
      });
      petMenu?.addEventListener("keydown", function (event) {
        var buttons = Array.from(petMenu.querySelectorAll("button"));
        var index = buttons.indexOf(shadow.activeElement);
        if (event.key === "Escape") {
          event.preventDefault();
          closePetMenu(true);
          return;
        }
        if (!/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = buttons.length - 1;
        else index = (Math.max(0, index) + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
        buttons[index]?.focus();
      });
      launcher.addEventListener("pointerdown", beginLauncherDrag);
      launcher.addEventListener("pointermove", moveLauncherDrag);
      launcher.addEventListener("pointerup", endLauncherDrag);
      launcher.addEventListener("pointercancel", cancelLauncherDrag);
      launcher.addEventListener("lostpointercapture", function (event) {
        if (launcherDragState && event.pointerId === launcherDragState.pointerId) cancelLauncherDrag(event);
      });
      launcher.addEventListener("pointerenter", function () {
        petPointerHover = true;
        pausePetAutonomy();
      });
      launcher.addEventListener("pointerleave", function () {
        petPointerHover = false;
        if (!launcherDragState) resumePetAutonomy();
      });
      launcher.addEventListener("focus", function () {
        petHasFocus = true;
        pausePetAutonomy();
      });
      launcher.addEventListener("blur", function () {
        petHasFocus = false;
        if (!launcherDragState) resumePetAutonomy();
      });
      var floorToggle = shadow.querySelector(".floor-toggle");
      var floorDrawer = shadow.querySelector(".floor-drawer");
      floorToggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var nextOpen = !floorDrawer.classList.contains("open");
        floorDrawer.classList.toggle("open", nextOpen);
        floorToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });
      modeButton.addEventListener("click", function () {
        if (selectionMode === "follow") {
          selectionMode = "manual";
          saveUiState();
          updateChrome();
        } else {
          followVisibleFloor();
        }
      });
      floorSelect.addEventListener("change", function () { selectFloor(floorSelect.value, "manual"); });
      shadow.querySelectorAll("[data-phone-drag]").forEach(function (handle) {
        handle.addEventListener("pointerdown", beginDrag);
      });
      shadow.querySelectorAll("[data-phone-resize]").forEach(function (handle) {
        handle.addEventListener("pointerdown", beginResize);
      });
      frame.addEventListener("load", function () {
        consumePendingProfileRole();
        host.setTimeout(function () { notifyStages(); }, 0);
        host.setTimeout(function () { notifyStages(); }, 350);
      });
      applySavedLauncherPosition();
      applySavedPosition();
      try {
        petMotionQuery = host.matchMedia("(prefers-reduced-motion: reduce)");
        petMotionHandler = function () {
          if (petMotionQuery && petMotionQuery.matches) pausePetAutonomy();
          else resumePetAutonomy();
        };
        if (petMotionQuery.addEventListener) petMotionQuery.addEventListener("change", petMotionHandler);
        else petMotionQuery.addListener?.(petMotionHandler);
      } catch (_) {}
      petVisibilityHandler = function () {
        if (hostDocument.hidden) pausePetAutonomy();
        else resumePetAutonomy();
      };
      hostDocument.addEventListener("visibilitychange", petVisibilityHandler);
      loadPetAssets();
      updateChrome();
    }

    function beginLauncherDrag(event) {
      if (!launcher || !petAssetsReady || petSwitching || (event.pointerType === "mouse" && event.button !== 0)) return;
      closePetMenu();
      pausePetAutonomy();
      commitPetRoamPosition();
      loadPetAsset(petCharacterId, "drag").catch(function () {});
      launcherDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        gripX: PET_RENDER_SIZE / 2,
        gripY: PET_DRAG_GRIP_Y,
        moved: false
      };
      suppressLauncherClick = false;
      launcher.classList.add("dragging");
      try { launcher.setPointerCapture(event.pointerId); } catch (_) {}
      clearPetMenuLongPress();
      if (event.pointerType !== "mouse") {
        var longPressPointerId = event.pointerId;
        petMenuLongPressTimer = host.setTimeout(function () {
          petMenuLongPressTimer = 0;
          if (!launcherDragState || launcherDragState.pointerId !== longPressPointerId || launcherDragState.moved) return;
          var held = launcherDragState;
          launcherDragState = null;
          launcher.classList.remove("dragging");
          try {
            if (launcher.hasPointerCapture && launcher.hasPointerCapture(held.pointerId)) launcher.releasePointerCapture(held.pointerId);
          } catch (_) {}
          suppressLauncherClick = true;
          openPetMenu(false);
        }, 500);
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function moveLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      var dx = event.clientX - launcherDragState.startX;
      var dy = event.clientY - launcherDragState.startY;
      if (!launcherDragState.moved && Math.hypot(dx, dy) >= 5) {
        clearPetMenuLongPress();
        launcherDragState.moved = true;
        setPetState("held_scared");
      }
      if (launcherDragState.moved) {
        var next = clampLauncherPosition(
          event.clientX - launcherDragState.gripX,
          event.clientY - launcherDragState.gripY
        );
        launcher.style.left = next.x + "px";
        launcher.style.top = next.y + "px";
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function endLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      clearPetMenuLongPress();
      var ended = launcherDragState;
      launcherDragState = null;
      launcher.classList.remove("dragging");
      try {
        if (launcher.hasPointerCapture && launcher.hasPointerCapture(ended.pointerId)) launcher.releasePointerCapture(ended.pointerId);
      } catch (_) {}
      if (ended.moved) {
        var rect = launcher.getBoundingClientRect();
        saveLauncherPosition(rect.left, rect.top);
        petOriginX = rect.left;
        petOriginY = rect.top;
        suppressLauncherClick = true;
        playPetLandingAfterDrag();
      } else if (!shellOpen) {
        resumePetAutonomy();
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function cancelLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      clearPetMenuLongPress();
      var cancelled = launcherDragState;
      launcherDragState = null;
      launcher.classList.remove("dragging");
      if (cancelled.moved) {
        var rect = launcher.getBoundingClientRect();
        saveLauncherPosition(rect.left, rect.top);
        petOriginX = rect.left;
        petOriginY = rect.top;
        suppressLauncherClick = true;
        playPetLandingAfterDrag();
      } else if (!shellOpen) {
        resumePetAutonomy();
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function beginDrag(event) {
      if (!panel || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button,select")) return;
      event.preventDefault();
      event.stopPropagation();
      var rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        handle: event.currentTarget,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top
      };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
      host.addEventListener("pointermove", moveDrag, true);
      host.addEventListener("pointerup", endDrag, true);
      host.addEventListener("pointercancel", endDrag, true);
    }

    function beginResize(event) {
      if (!panel || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      event.stopPropagation();
      var rect = panel.getBoundingClientRect();
      resizeState = {
        pointerId: event.pointerId,
        handle: event.currentTarget,
        corner: event.currentTarget.getAttribute("data-phone-resize") === "left" ? "left" : "right",
        startX: event.clientX,
        startY: event.clientY,
        startScale: normalizedPhoneScale(panel.dataset.phoneScale),
        left: rect.left,
        top: rect.top,
        right: rect.right
      };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
      host.addEventListener("pointermove", moveResize, true);
      host.addEventListener("pointerup", endResize, true);
      host.addEventListener("pointercancel", endResize, true);
    }

    function moveResize(event) {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return;
      event.preventDefault();
      var horizontal = (event.clientX - resizeState.startX) / 430 * (resizeState.corner === "left" ? -1 : 1);
      var vertical = (event.clientY - resizeState.startY) / 812;
      var delta = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
      var scale = syncPanelSize(resizeState.startScale + delta);
      var rect = panel.getBoundingClientRect();
      var x = resizeState.corner === "left" ? resizeState.right - rect.width : resizeState.left;
      var next = clampPosition(x, resizeState.top);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
      panel.dataset.phoneScale = String(scale);
    }

    function endResize(event) {
      if (!resizeState || (event && event.pointerId !== resizeState.pointerId)) return;
      var ended = resizeState;
      resizeState = null;
      host.removeEventListener("pointermove", moveResize, true);
      host.removeEventListener("pointerup", endResize, true);
      host.removeEventListener("pointercancel", endResize, true);
      try {
        if (ended.handle?.hasPointerCapture?.(ended.pointerId)) ended.handle.releasePointerCapture(ended.pointerId);
      } catch (_) {}
      var rect = panel.getBoundingClientRect();
      savePhoneScale(panel.dataset.phoneScale, rect.left, rect.top);
    }

    function moveDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      event.preventDefault();
      var next = clampPosition(event.clientX - dragState.dx, event.clientY - dragState.dy);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function endDrag(event) {
      if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
      var ended = dragState;
      host.removeEventListener("pointermove", moveDrag, true);
      host.removeEventListener("pointerup", endDrag, true);
      host.removeEventListener("pointercancel", endDrag, true);
      try {
        if (ended.handle && ended.handle.hasPointerCapture && ended.handle.hasPointerCapture(ended.pointerId)) {
          ended.handle.releasePointerCapture(ended.pointerId);
        }
      } catch (_) {}
      var rect = panel.getBoundingClientRect();
      savePosition(rect.left, rect.top);
      dragState = null;
    }

    function toggleShell(open) {
      ensureShell();
      shellOpen = Boolean(open);
      if (shellOpen && petMenuOpen) closePetMenu();
      panel.classList.toggle("open", shellOpen);
      launcher.setAttribute("aria-expanded", shellOpen || petMenuOpen ? "true" : "false");
      launcher.setAttribute("aria-label", (shellOpen ? "关闭悬浮手机" : "打开悬浮手机") + " · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
      launcher.classList.toggle("active", shellOpen);
      if (shellOpen) {
        pausePetAutonomy();
        if (selectionMode === "follow") followVisibleFloor();
        else updateChrome();
        applySavedPosition();
        mountPhone(false);
        playPetShellAction("unique_a", true);
      } else {
        hideEncounterDetail();
        updateProfileNeighbors(null);
        var drawer = shadow.querySelector(".floor-drawer");
        var toggle = shadow.querySelector(".floor-toggle");
        if (drawer) drawer.classList.remove("open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        resumePetAutonomy();
        playPetShellAction("unique_b", false);
      }
    }

    function consumePendingProfileRole() {
      var name = textId(pendingProfileRole);
      if (!name) return true;
      try {
        var phoneWindow = frame && frame.contentWindow;
        var openProfile = phoneWindow && phoneWindow.__ST_OPEN_PROFILE_APP__;
        if (typeof openProfile !== "function") return false;
        pendingProfileRole = "";
        // 分组与具体页面。首次使用仍由人物档案自身回退到“衣着”。
        openProfile("", name);
        return true;
      } catch (_) { return false; }
    }

    function schedulePendingProfileOpen(attempts) {
      if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
      profileOpenTimer = 0;
      if (consumePendingProfileRole() || attempts <= 0) return;
      profileOpenTimer = host.setTimeout(function () {
        profileOpenTimer = 0;
        schedulePendingProfileOpen(attempts - 1);
      }, 100);
    }

    function openProfileRole(roleName) {
      pendingProfileRole = textId(roleName);
      if (!pendingProfileRole) return false;
      toggleShell(true);
      schedulePendingProfileOpen(20);
      return true;
    }

    function updateChrome() {
      ensureShell();
      var floors = floorItems();
      var ids = floors.map(function (item) { return item.id; });
      if (!selectedId || ids.indexOf(selectedId) < 0) selectedId = writableId() || (floors.length ? floors[floors.length - 1].id : "");
      floorSelect.innerHTML = floors.map(function (item) {
        var suffix = item.snapshot ? "有变量" : "无快照";
        var current = item.id === writableId() ? "当前" : "历史";
        return "<option value='" + escapeHtml(item.id) + "'>第 " + escapeHtml(item.floor) + " 楼 · 滑动" + escapeHtml(item.swipe) + " · " + current + " · " + suffix + "</option>";
      }).join("");
      floorSelect.value = selectedId;
      modeButton.textContent = selectionMode === "follow" ? "跟随视口" : "手动选楼";
      var writable = isWritable();
      stateBadge.textContent = writable ? "当前楼 · 可操作" : "历史楼 · 只读";
      stateBadge.classList.toggle("history", !writable);
      panel.classList.toggle("history", !writable);
      titleFloor.textContent = selectedId ? "楼层 " + selectedId : "等待楼层";
      var count = phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
      var note = phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
      var total = (Array.isArray(count) ? count.length : 0) + (String(note || "").trim() ? 1 : 0);
      var launcherBadge = shadow.querySelector(".launcher i");
	      if (launcherBadge) launcherBadge.textContent = String(total);
	      refreshSidecarResources();
	      refreshVariableFormatCheck();
	    }

    function refreshPhone() {
      if (!frame || !frame.contentWindow) return;
      try {
        frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent("HYPNOOS_FLOATING_FLOOR_CHANGED", { detail: { messageId: selectedId, writable: isWritable() } }));
        frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__ && frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__();
      } catch (_) {}
    }

    function notifyReadOnly() {
      updateChrome();
      if (!panel || !shadow) return;
      var badge = shadow.querySelector(".readonly");
      if (!badge) return;
      badge.textContent = "历史楼层 · 只读；切回当前楼后才能操作";
      badge.animate([{ transform: "translateY(-3px)", opacity: .65 }, { transform: "translateY(0)", opacity: 1 }], { duration: 220 });
    }

    function phoneApi(name, args, quiet) {
      try {
        var phoneWindow = frame && frame.contentWindow;
        var fn = phoneWindow && phoneWindow[name];
        if (typeof fn === "function") return fn.apply(phoneWindow, Array.isArray(args) ? args : []);
      } catch (error) {
        if (!quiet) console.warn("[HypnoOS] 悬浮手机 API 调用失败", name, error);
      }
      return undefined;
    }

    function notifyStages() {
      updateChrome();
      stageSubscribers.forEach(function (subscriber) {
        try { subscriber(); } catch (_) {}
      });
    }

    function register(owner) {
      var id = textId(owner.messageId) || "unknown-" + token;
      var previousWritable = writableId();
      var existing = owners.get(id);
      owners.set(id, owner);
      if (!existing) ownerOrder.push(id);
	  else if (existing.token !== owner.token && ownerOrder.indexOf(id) < 0) ownerOrder.push(id);
      var nextWritable = writableId();
      if (!selectedId || selectionMode === "follow" || selectedId === previousWritable) selectedId = nextWritable;
      ensureShell();
      if (loadedForWritableId && previousWritable !== nextWritable) scheduleMount(true);
      else scheduleMount(false);
      updateChrome();
      notifyStages();
      // StatusPlaceHolder 的 stage iframe 只会在本楼最终正则 DOM 已经落地后注册。
      // 以这里作为确定性的正文最终化钩子，避免较早的 mutation/rAF 渲染
      // 又被酒馆随后一次 markdown/regex 整块重建覆盖。
      scheduleActionFoldRender();
    }

    function unregister(id, ownerToken) {
      var current = owners.get(id);
      if (!current || current.token !== ownerToken) return;
      owners.delete(id);
      ownerOrder = ownerOrder.filter(function (item) { return item !== id; });
      if (selectionMode === "follow" || selectedId === id) selectedId = writableId();
      updateChrome();
      notifyStages();
    }

    hostClickHandler = function (event) {
      var id = mesIdFromElement(event.target);
      if (selectionMode === "follow" && id && floorItems().map(function (item) { return item.id; }).indexOf(id) >= 0) {
        selectFloor(id, "follow");
      }
    };
    hostResizeHandler = function () {
      if (launcher) applySavedLauncherPosition();
      if (panel) applySavedPosition();
    };
    hostDocument.addEventListener("click", hostClickHandler, true);
    host.addEventListener("resize", hostResizeHandler, { passive: true });
    try {
      host.visualViewport?.addEventListener?.("resize", hostResizeHandler, { passive: true });
      host.visualViewport?.addEventListener?.("scroll", hostResizeHandler, { passive: true });
    } catch (_) {}

    registryApi = {
      revision: config.revision,
      start: function () {
        var topologyChanged = reconcileChatState();
        ensureActionFoldRenderer();
        ensureShell();
        subscribeSidecarResourceEvents();
        if (!selectedId || selectionMode === "follow") selectedId = writableId();
        scheduleMount(topologyChanged);
        updateChrome();
        notifyStages();
      },
      register: register,
      unregister: unregister,
      getSelectedId: function () { return selectedId || writableId(); },
      getWritableId: writableId,
      isWritable: isWritable,
      selectFloor: selectFloor,
      normalizeMessageOption: normalizeMessageOption,
      normalizeWriteMessageOption: normalizeWriteMessageOption,
      hasApi: function (name) { return Boolean(findFunction(name)); },
      callApi: callApi,
      readApi: readApi,
      guardedApi: guardedApi,
      callMvu: callMvu,
      hasMvu: function (name) { var mvu = findMvu(); return Boolean(mvu && typeof mvu[name] === "function"); },
      readMvu: readMvu,
      guardedMvu: guardedMvu,
      notifyReadOnly: notifyReadOnly,
      getMvu: findMvu,
      getContext: context,
      getCurrentChatId: function () {
        for (var i = 0; i < sourceWindows().length; i += 1) {
          try {
            var fn = sourceWindows()[i].SillyTavern && sourceWindows()[i].SillyTavern.getCurrentChatId;
            if (typeof fn === "function") return fn.call(sourceWindows()[i].SillyTavern);
          } catch (_) {}
        }
        return "";
      },
      getRequestHeaders: hostRequestHeaders,
      directSend: function (text) { return callApi("directSend", [text]); },
      readInformation: readInformationSnapshot,
      selectInformationFloor: function (id) {
        selectFloor(textId(id), "manual");
        return readInformationSnapshot();
      },
      toggleInformationMode: function () {
        if (selectionMode === "follow") {
          selectionMode = "manual";
          saveUiState();
          updateChrome();
          refreshPhone();
        } else {
          followVisibleFloor();
        }
        return readInformationSnapshot();
      },
      switchInformationPet: function () {
        return switchPetCharacter().then(readInformationSnapshot);
      },
      selectInformationPet: function (id) {
        return selectPetCharacter(id).then(readInformationSnapshot);
      },
      toggleInformationPetMode: function () {
        return setPetDisplayMode(petDisplayMode === "stored" ? "floating" : "stored");
      },
      phoneApi: phoneApi,
      notifyStages: notifyStages,
      renderActionFoldMarkers: scheduleActionFoldRender,
      subscribeStage: function (fn) { stageSubscribers.add(fn); return function () { stageSubscribers.delete(fn); }; },
      openPhone: function () { toggleShell(true); },
      openProfileRole: openProfileRole,
      showEncounterDetail: showEncounterDetail,
      hideEncounterDetail: hideEncounterDetail,
      updateEncounterPossessionDecor: updateEncounterPossessionDecor,
      updateProfileNeighbors: updateProfileNeighbors,
      updateProfilePossession: updateProfilePossession,
      updateHypnosisPerch: updateHypnosisPerch,
      updateWorkLever: updateWorkLever,
      updateMapExtraChain: updateMapExtraChain,
      updateLocationRuleRadar: updateLocationRuleRadar,
      ensureOpeningWorldbooks: ensureOpeningWorldbooks,
      updateChrome: updateChrome,
      destroy: function () {
        if (mountTimer) host.clearTimeout(mountTimer);
        mountTimer = 0;
        clearPetFrameTimer();
        clearPetActivityTimer();
        clearPetMotionFrame();
        clearPetMenuLongPress();
        try { wandObserver?.disconnect?.(); } catch (_) {}
        wandObserver = null;
        try { wandPetEntry?.remove?.(); } catch (_) {}
        wandPetEntry = null;
        try {
          if (petMotionQuery && petMotionHandler) {
            if (petMotionQuery.removeEventListener) petMotionQuery.removeEventListener("change", petMotionHandler);
            else petMotionQuery.removeListener?.(petMotionHandler);
          }
        } catch (_) {}
        try {
          if (petVisibilityHandler) hostDocument.removeEventListener("visibilitychange", petVisibilityHandler);
        } catch (_) {}
        petMotionQuery = null;
        petMotionHandler = null;
        petVisibilityHandler = null;
        petAssetsReady = false;
        petReadyAssets.clear();
        petImageCache.clear();
        petLoadPromises.clear();
        petLoadQueue.length = 0;
        petLoadsInFlight = 0;
        petMenu = null;
        petMenuOpen = false;
        petSprite = null;
        if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
        profileOpenTimer = 0;
        pendingProfileRole = "";
        resourceRefreshToken += 1;
        resourceEventStops.splice(0).forEach(function (item) {
          try {
            if (typeof item.handle === "function") item.handle();
            else item.handle?.stop?.() || item.handle?.unsubscribe?.() || item.handle?.off?.();
            var off = findFunction("eventOff");
            if (off) off.fn.call(off.view, item.eventName, item.handler);
          } catch (_) {}
        });
        resourceEventsSubscribed = false;
        try { fetchController?.abort?.(); } catch (_) {}
        fetchController = null;
        try { actionFoldObserver && actionFoldObserver.disconnect(); } catch (_) {}
        actionFoldObserver = null;
        if (actionFoldRenderFrame) {
          try {
            if (host.cancelAnimationFrame) host.cancelAnimationFrame(actionFoldRenderFrame);
            else host.clearTimeout(actionFoldRenderFrame);
          } catch (_) {}
        }
        actionFoldRenderFrame = 0;
        hideEncounterDetail();
        updateEncounterPossessionDecor(null);
        updateProfileNeighbors(null);
        updateProfilePossession(null);
        updateHypnosisPerch(null);
        updateWorkLever(null);
        updateMapExtraChain(null);
        updateLocationRuleRadar({ visible: false, immediate: true });
        if (locationRuleRadarTimer) host.clearTimeout(locationRuleRadarTimer);
        locationRuleRadarTimer = 0;
        encounterDetailHost = null;
        encounterPossessionDecorHost = null;
        profileNeighborHost = null;
        profilePossessionHost = null;
        workLeverHost = null;
	        mapExtraChainHost = null;
	        resourcePanel = null;
	        variableFormatButton = null;
	        variableFormatDialog = null;
        try { hostDocument.removeEventListener("click", hostClickHandler, true); } catch (_) {}
        try { host.removeEventListener("resize", hostResizeHandler); } catch (_) {}
        try { host.visualViewport?.removeEventListener?.("resize", hostResizeHandler); } catch (_) {}
        try { host.visualViewport?.removeEventListener?.("scroll", hostResizeHandler); } catch (_) {}
        try { host.removeEventListener("pointermove", moveDrag, true); } catch (_) {}
        try { host.removeEventListener("pointerup", endDrag, true); } catch (_) {}
        try { host.removeEventListener("pointercancel", endDrag, true); } catch (_) {}
        try { host.removeEventListener("pointermove", moveResize, true); } catch (_) {}
        try { host.removeEventListener("pointerup", endResize, true); } catch (_) {}
        try { host.removeEventListener("pointercancel", endResize, true); } catch (_) {}
        try { host.removeEventListener("message", openingWorldbookMessageHandler); } catch (_) {}
        try { shell?.remove?.(); } catch (_) {}
        stageSubscribers.clear();
        owners.clear();
        ownerOrder = [];
      }
    };
    var openingWorldbookMessageHandler = function (event) {
      var payload = event && event.data;
      if (!payload || payload.type !== "ST_HYPNOOS_OPENING_WORLDINFO_REQUEST" || !payload.requestId) return;
      Promise.resolve(ensureOpeningWorldbooks(payload.entries, payload.fallbackName)).then(function (result) {
        try {
          event.source?.postMessage?.({
            type: "ST_HYPNOOS_OPENING_WORLDINFO_RESPONSE",
            requestId: payload.requestId,
            result: result
          }, "*");
        } catch (_) {}
      });
    };
    try { host.addEventListener("message", openingWorldbookMessageHandler); } catch (_) {}
    return registryApi;
  }

  function ensureRegistry(host) {
    try {
      var existing = host[config.singletonKey];
      if (existing && existing.revision === config.revision) return existing;
      if (existing && existing.destroy) existing.destroy();
      var created = createRegistry(host);
      host[config.singletonKey] = created;
      return created;
    } catch (error) {
      console.error("[HypnoOS] 无法创建悬浮手机", error);
      return null;
    }
  }

  function stageCss() {
    return [
      "html,body{margin:0;background:transparent!important;color:inherit}body{padding:0!important}",
      ".stage{--dq-night:#070b18;--dq-panel:#111c39;--dq-ink:#f7f1dc;--dq-muted:#b8c0d4;--dq-gold:#e7c46a;--dq-gold2:#80652f;position:relative;margin:10px 0;border:3px double var(--dq-gold);border-radius:7px;background:radial-gradient(circle at 50% -15%,rgba(68,112,190,.28),transparent 40%),repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px),linear-gradient(180deg,var(--dq-panel),var(--dq-night));box-shadow:0 0 0 2px #03050c,0 16px 38px rgba(2,6,23,.42),inset 0 0 26px rgba(0,0,0,.38);color:var(--dq-ink);font-family:'Palatino Linotype','Noto Serif SC','Songti SC',serif;overflow:hidden}.stage:before,.stage:after{content:'◆';position:absolute;z-index:3;top:5px;color:var(--dq-gold);font-size:9px;pointer-events:none}.stage:before{left:7px}.stage:after{right:7px}",
      ".head{display:flex;align-items:center;gap:9px;padding:15px 14px 11px;border-bottom:3px double var(--dq-gold2);background:linear-gradient(180deg,rgba(69,120,201,.16),rgba(4,8,22,.14))}.head-title{display:grid;gap:3px}.head-title strong{font-size:15px;letter-spacing:.08em;text-shadow:0 2px #000}.head-title small{color:#dfcf9c;font-size:10px;font-weight:800}.grow{flex:1}",
      ".open{border:2px solid #7182a8;border-radius:3px;background:linear-gradient(#273c69,#111d3c);box-shadow:inset 0 0 0 1px #080d1c,0 2px #02040a;color:#f7f1dc;font:800 11px inherit;padding:7px 10px;cursor:pointer}.status{padding:4px 8px;border:1px solid #648d7a;border-radius:3px;background:#10271f;color:#bfe2c8;font:850 9px inherit}.status.history{border-color:#8b7135;background:#27200f;color:#f0d783}",
      ".body{padding:11px 12px 12px}.empty{padding:18px;border:3px double var(--dq-gold2);border-radius:4px;text-align:center;color:var(--dq-muted);font-size:11px;line-height:1.6;background:rgba(5,10,27,.72)}.empty.waiting{animation:stagePulse 1.6s ease-in-out infinite}@keyframes stagePulse{50%{border-color:#7ea1d5;color:#d7e6ff}}",
      ".list{display:grid;gap:9px;max-height:300px;overflow:auto;scrollbar-width:thin;scrollbar-color:#80652f #070b18}.item{--accent:#9ca8c3;--soft:rgba(93,108,143,.16);position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;padding:10px;border:2px solid color-mix(in srgb,var(--accent) 54%,#1c2541);border-radius:4px;background:linear-gradient(180deg,color-mix(in srgb,var(--soft) 72%,#162344),#0a1129 88%);box-shadow:inset 0 0 0 1px rgba(231,196,106,.16),0 5px 0 rgba(0,0,0,.2);overflow:hidden}.item:before{content:'';position:absolute;inset:4px auto 4px 4px;width:2px;background:var(--accent)}.item:after{content:'';position:absolute;right:3px;bottom:3px;width:7px;height:7px;border-right:1px solid var(--dq-gold2);border-bottom:1px solid var(--dq-gold2)}.item.tone-hypnosis{--accent:#b98bd4;--soft:rgba(120,66,144,.22)}.item.tone-reward{--accent:#e7c46a;--soft:rgba(148,111,35,.22)}.item.tone-schedule{--accent:#7da9df;--soft:rgba(53,91,139,.22)}.item.tone-location{--accent:#65c7c1;--soft:rgba(39,111,112,.2)}.item.tone-profile{--accent:#cf8ba9;--soft:rgba(130,60,92,.2)}.item.tone-activity{--accent:#83be80;--soft:rgba(57,111,63,.2)}.item.tone-inventory{--accent:#d59a64;--soft:rgba(127,76,38,.22)}.item.is-locked{--accent:#f0cf76;--soft:rgba(115,88,31,.2);border-color:#a9873d}",
      ".item-icon{width:32px;height:32px;border:2px solid color-mix(in srgb,var(--accent) 64%,#202a45);border-radius:50%;background:radial-gradient(circle,#1d2d54,#080e22 70%);color:var(--accent);display:grid;place-items:center;font-weight:950;box-shadow:inset 0 0 0 2px rgba(0,0,0,.32)}.item-content{min-width:0;display:grid;gap:5px}.item-top{display:flex;align-items:center;gap:6px}.item-source{min-width:0;padding:2px 6px;border:1px solid color-mix(in srgb,var(--accent) 48%,#202a45);border-radius:3px;background:#080e20;color:color-mix(in srgb,var(--accent) 78%,white);font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-state{margin-left:auto;color:#abb4c9;font-size:9px;font-weight:850;white-space:nowrap}.item.is-locked .item-state{color:#f0cf76}.item h3{margin:0;color:var(--dq-ink);font-size:12px;line-height:1.35;text-shadow:0 1px #000}.item p{margin:0;color:#d2d8e7;font-size:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.item-remove{position:absolute;right:8px;bottom:8px;width:24px;height:24px;border:1px solid #8c4750;border-radius:2px;background:#37141e;color:#f2b5bb;font-size:15px;cursor:pointer}.item-remove:disabled{border-color:#8b7135;background:#211b10;color:#f0cf76;font-size:11px;cursor:not-allowed}",
      ".item-detail{border-top:1px solid #3b4665;padding-top:5px;margin-right:30px}.item-detail summary{cursor:pointer;list-style:none;color:#c7ccda;font-size:9px;font-weight:900}.item-detail summary::-webkit-details-marker{display:none}.detail-list{margin-top:6px;display:grid;gap:4px}.detail-row{display:grid;grid-template-columns:minmax(62px,.38fr) minmax(0,1fr);gap:7px;padding:5px 6px;border:1px solid #2d3858;border-radius:2px;background:#070d20;font-size:9px;line-height:1.4}.detail-row b{color:var(--accent);overflow-wrap:anywhere}.detail-row span{color:#d3d8e7;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".note{box-sizing:border-box;width:100%;min-height:68px;margin-top:10px;padding:9px 10px;resize:vertical;border:1px solid #536082;border-radius:3px;background:#050a19;color:#f0f2f8;font:11px/1.55 'Noto Serif SC','Songti SC',serif;outline:none}.note:focus{border-color:var(--dq-gold);box-shadow:0 0 0 2px rgba(231,196,106,.14)}.actions{display:flex;align-items:center;gap:7px;margin-top:9px}.actions label{margin-right:auto;color:#c2c9d9;font-size:10px}.actions button{border:2px solid #7884a5;border-radius:3px;background:linear-gradient(#273860,#111b38);box-shadow:inset 0 0 0 1px #080c19,0 2px #02040a;color:#f5f1e4;font:850 10px inherit;padding:8px 10px;cursor:pointer}.actions .send{border-color:var(--dq-gold);background:linear-gradient(#315a9e,#183364);color:#fff8db}.actions button:disabled,.note:disabled{opacity:.45;cursor:not-allowed}",
      ".modal{position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:rgba(2,4,12,.78);backdrop-filter:blur(7px);padding:14px}.modal-card{max-width:360px;border:3px double var(--dq-gold);border-radius:5px;background:linear-gradient(#172548,#080d20);color:var(--dq-ink);padding:18px;box-shadow:0 22px 64px rgba(0,0,0,.54)}.modal-card p{font-size:12px;line-height:1.65;color:#c1c8d8}.modal-card div{display:flex;justify-content:flex-end;gap:8px}.modal-card button{border:2px solid #7884a5;border-radius:3px;background:linear-gradient(#273860,#111b38);color:#f5f1e4;padding:8px 11px;font-weight:800}.modal-card .danger{border-color:#a75a62;background:linear-gradient(#682634,#35131c);color:#ffd6d8}"
    ].join("");
  }

  function stageVisual(item) {
    var allowed = ["hypnosis", "reward", "schedule", "location", "profile", "activity", "inventory", "system"];
    var tone = allowed.indexOf(String(item && item.tone || "")) >= 0 ? String(item.tone) : "system";
    return {
      tone: tone,
      icon: String(item && item.icon || "◆"),
      state: item && item.locked ? "🔒 已锁定" : "可撤销"
    };
  }

  function stageDetailsHtml(item) {
    var details = Array.isArray(item && item.details) ? item.details.filter(function (entry) {
      return entry && entry.label && entry.value;
    }) : [];
    if (!details.length) return "";
    var rows = details.map(function (entry) {
      return "<div class='detail-row'><b>" + escapeHtml(entry.label) + "</b><span>" + escapeHtml(entry.value) + "</span></div>";
    }).join("");
    return "<details class='item-detail'><summary>查看完整内容 · " + details.length + " 项</summary><div class='detail-list'>" + rows + "</div></details>";
  }

  function renderStage(registry, root, messageId) {
    var writable = registry.getWritableId() === messageId;
    var selectedWritable = registry.isWritable();
    var views = registry.phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
    var note = registry.phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
    var keep = registry.phoneApi("__ST_READ_OPERATION_KEEP_AFTER_FLUSH__", [], true);
    var ready = Array.isArray(views);
    views = ready ? views : [];
    var body = "";
    if (!writable) {
      body = "<div class='empty'>此楼只保留历史占位。可打开悬浮手机查看该楼变量；暂存操作只在当前楼编辑。</div>";
    } else if (!ready) {
      body = "<div class='empty'>悬浮手机正在连接暂存队列…</div>";
    } else {
      var list = views.length ? "<div class='list'>" + views.map(function (item) {
        var visual = stageVisual(item);
        return "<article class='item tone-" + visual.tone + (item.locked ? " is-locked" : "") + "'>" +
          "<span class='item-icon' aria-hidden='true'>" + escapeHtml(visual.icon) + "</span>" +
          "<div class='item-content'><div class='item-top'><span class='item-source'>" + escapeHtml(item.source || "APP") + "</span><span class='item-state'>" + escapeHtml(visual.state) + "</span></div>" +
          "<h3>" + escapeHtml(item.action || "操作") + "</h3><p>" + escapeHtml(item.summary || "无附加信息") + "</p>" + stageDetailsHtml(item) + "</div>" +
          "<button class='item-remove' type='button' data-remove='" + escapeHtml(item.id || item.key) + "' " + (item.locked ? "disabled title='锁定操作'" : "title='移除'") + ">" + (item.locked ? "🔒" : "×") + "</button></article>";
      }).join("") + "</div>" : "<div class='empty'>还没有本轮操作。手机中的命令、任务与购买会先暂存在这里。</div>";
      body = list + "<textarea class='note' placeholder='写给 AI 的普通备注，不会替代前端操作。'>" + escapeHtml(note || "") + "</textarea>" +
        "<div class='actions'><label><input class='keep' type='checkbox' " + (keep ? "checked" : "") + "> 确认后保留</label><button type='button' data-clear>清空</button><button class='send' type='button' data-flush>写入输入框</button></div>";
    }
    var lockedCount = views.filter(function (item) { return Boolean(item && item.locked); }).length;
    root.innerHTML = "<section class='stage'><header class='head'><div class='head-title'><strong>本轮操作暂存</strong><small>共 " + views.length + " 条" + (lockedCount ? " · " + lockedCount + " 条已锁定" : "") + "</small></div><span class='grow'></span><span class='status " + (writable && selectedWritable ? "" : "history") + "'>" + (writable ? (selectedWritable ? "当前楼" : "手机正查看历史") : "历史楼") + "</span><button class='open' type='button'>打开手机</button></header><div class='body'>" + body + "</div></section>";
    root.querySelector(".open").addEventListener("click", function () { registry.openPhone(); });
    var noteInput = root.querySelector(".note");
    if (noteInput) {
      noteInput.addEventListener("input", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value, { emit: false }]); });
      noteInput.addEventListener("change", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value]); });
    }
    var keepInput = root.querySelector(".keep");
    if (keepInput) keepInput.addEventListener("change", function () { registry.phoneApi("__ST_WRITE_OPERATION_KEEP_AFTER_FLUSH__", [keepInput.checked]); registry.notifyStages(); });
    root.querySelectorAll("[data-remove]").forEach(function (button) {
      button.addEventListener("click", function () { registry.phoneApi("__ST_REMOVE_PENDING_OPERATION__", [button.dataset.remove]); registry.notifyStages(); });
    });
    var flush = root.querySelector("[data-flush]");
    if (flush) flush.addEventListener("click", function () { registry.phoneApi("__ST_FLUSH_OPERATION_TO_INPUT__", []); });
    var clear = root.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      showStageConfirm(root, "清空未锁定的暂存内容？", "锁定操作仍会保留；普通操作和备注将不会写入本轮输入。", function () {
        registry.phoneApi("__ST_CLEAR_OPERATION_INPUT_LOG__", []);
        registry.notifyStages();
      });
    });
  }

  function showStageConfirm(root, title, message, confirm) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = "<section class='modal-card'><strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message) + "</p><div><button type='button' data-cancel>取消</button><button class='danger' type='button' data-confirm>确认</button></div></section>";
    modal.addEventListener("click", function (event) { if (event.target === modal || event.target.closest("[data-cancel]")) modal.remove(); });
    modal.querySelector("[data-confirm]").addEventListener("click", function () { modal.remove(); confirm(); });
    root.appendChild(modal);
  }

  var host = findHostWindow();
  if (config.mode === "host") {
    var hostRegistry = ensureRegistry(host);
    if (!hostRegistry) return;
    hostRegistry.start();
    try {
      host.dispatchEvent(new host.CustomEvent(config.registryEvent, { detail: { revision: config.revision } }));
    } catch (_) {}
    return;
  }

  document.documentElement.dataset.hypnoosStagingOnly = "true";
  var style = document.createElement("style");
  style.textContent = stageCss();
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "hypnoos-operation-placeholder";
  document.body.replaceChildren(root, script);

  var stageAttached = false;
  var unsubscribe = function () {};
  var ownMessageId = "";
  function attachStage(registry) {
    if (stageAttached || !registry) return;
    stageAttached = true;
    ownMessageId = messageIdFromWindow() || registry.getWritableId() || "current";
    registry.register({ token: token, messageId: ownMessageId, view: window, config: config });
    unsubscribe = registry.subscribeStage(function () { renderStage(registry, root, ownMessageId); });
    renderStage(registry, root, ownMessageId);
  }
  function registryReady() {
    try {
      var registry = host[config.singletonKey];
      if (registry && registry.revision === config.revision) attachStage(registry);
    } catch (_) {}
  }
  registryReady();
  if (!stageAttached) {
    root.innerHTML = "<section class='stage'><div class='empty waiting'>酒馆助手正在启动悬浮手机与暂存队列…</div></section>";
    try { host.addEventListener(config.registryEvent, registryReady); } catch (_) {}
  }

  window.addEventListener("pagehide", function () {
    try { host.removeEventListener(config.registryEvent, registryReady); } catch (_) {}
    try { unsubscribe(); } catch (_) {}
    try { host[config.singletonKey]?.unregister?.(ownMessageId, token); } catch (_) {}
  }, { once: true });
})();
