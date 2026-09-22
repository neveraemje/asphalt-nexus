"use strict";
(() => {
  // apps/figma-plugin/src/ia.ts
  var maximumTraversalDepth = 24;
  var maximumSemanticDepth = 4;
  var maximumIaElements = 180;
  var excludedGeometryTypes = /* @__PURE__ */ new Set([
    "BOOLEAN_OPERATION",
    "LINE",
    "POLYGON",
    "STAR",
    "VECTOR"
  ]);
  function generateInformationArchitecture(screenName, snapshot, generatedAt) {
    if (!snapshot) {
      return createEmptyInformationArchitecture(screenName, generatedAt);
    }
    if (snapshot.props.snapshotComplete === false) {
      return createUnavailableInformationArchitecture(
        screenName,
        generatedAt,
        "The saved Figma node subtree is incomplete. Re-push the screen to capture its complete semantic structure."
      );
    }
    if (isFlattenedPreviewSnapshot(snapshot)) {
      return createUnavailableInformationArchitecture(
        screenName,
        generatedAt,
        "The selected node exposes image pixels but no complete editable child structure. Select and push the original editable screen frame."
      );
    }
    const budget = { remaining: maximumIaElements };
    const rootChildren = groupRepeatedSiblings(
      sortSnapshotsByContentOrder(snapshot.children || [], snapshot),
      snapshot
    );
    const builtRegions = rootChildren.map((child, index) => buildInformationArchitectureNode(child, {
      depth: 0,
      index,
      parent: snapshot,
      siblings: rootChildren
    }, budget)).filter((node) => Boolean(node));
    const regions = pruneInformationArchitectureDepth(
      renumberInformationArchitectureNodes(
        builtRegions.flatMap(flattenSingleChildWrappers)
      )
    );
    if (regions.length === 0) {
      const fallback = buildInformationArchitectureNode(snapshot, {
        depth: 0,
        index: 0,
        siblings: [snapshot]
      }, budget);
      if (fallback) {
        regions.push(...pruneInformationArchitectureDepth(
          renumberInformationArchitectureNodes(flattenSingleChildWrappers(fallback))
        ));
      }
    }
    regions.forEach(assignSiblingActionPriorities);
    return {
      analysisMode: "unavailable",
      coverageNote: "Node-only IA generated from hierarchy, labels, order, repetition, and inferred function.",
      elementCount: countInformationArchitectureNodes(regions),
      generatedAt,
      purpose: `Node-derived content and action structure for ${screenName}.`,
      regions,
      screenType: "screen",
      source: "figma-node-tree",
      textCount: countInformationArchitectureNodes(
        regions,
        (node) => node.role === "label" || node.role === "text"
      ),
      version: 10
    };
  }
  function createEmptyInformationArchitecture(screenName, generatedAt) {
    return {
      analysisMode: "structure-first",
      coverageNote: "No saved Figma node structure was available for analysis.",
      elementCount: 0,
      generatedAt,
      purpose: `Node-derived content and action structure for ${screenName}.`,
      regions: [],
      screenType: "screen",
      source: "figma-node-tree",
      textCount: 0,
      version: 10
    };
  }
  function createUnavailableInformationArchitecture(screenName, generatedAt, coverageNote) {
    return {
      analysisMode: "unavailable",
      coverageNote,
      elementCount: 0,
      generatedAt,
      purpose: `Node-derived content and action structure for ${screenName}.`,
      regions: [],
      screenType: "screen",
      source: "figma-node-tree",
      textCount: 0,
      version: 10
    };
  }
  function buildInformationArchitectureNode(snapshot, context, budget) {
    if (context.depth > maximumTraversalDepth || budget.remaining <= 0 || snapshot.props.visible === false) {
      return null;
    }
    const hasChildren = Boolean(snapshot.children?.length);
    if (isExcludedNode(snapshot, hasChildren)) return null;
    budget.remaining -= 1;
    const role = inferNodeFunction(snapshot, context);
    const orderedChildren = snapshot.type === "INSTANCE" && !shouldExpandCompositeInstance(snapshot, context) ? [] : groupRepeatedSiblings(
      sortSnapshotsByContentOrder(snapshot.children || [], snapshot),
      snapshot
    );
    let children = orderedChildren.map((child, index) => buildInformationArchitectureNode(child, {
      depth: context.depth + 1,
      index,
      parent: snapshot,
      siblings: orderedChildren
    }, budget)).filter((node) => Boolean(node));
    if (role === "action" && children.every((child) => child.role === "label" || child.role === "text")) {
      children = [];
    }
    const label = inferNodeLabel(snapshot, role, context, children);
    const text = readSnapshotText(snapshot);
    const exampleValue = text && normalizeForComparison(label) !== normalizeForComparison(text) ? text : void 0;
    const repeated = role === "collection";
    const persistent = role === "navigation" && isPersistentComponent(snapshot, context);
    const repeatCount = getNumericProp(snapshot, "repeatCount") || void 0;
    return {
      children,
      confidence: inferNodeConfidence(snapshot, label, role),
      description: describeNodeFunction(
        role,
        label,
        context.index + 1,
        children.length,
        persistent,
        repeatCount
      ),
      exampleValue,
      label,
      persistent,
      repeatCount,
      repeated,
      role,
      sequence: context.index + 1,
      sourceName: snapshot.name,
      sourceType: snapshot.type
    };
  }
  function inferNodeFunction(snapshot, context) {
    const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase();
    const descendantText = findFirstDescendantText(snapshot);
    const parentName = context.parent ? humanizeLayerName(stripNamingConvention(context.parent.name)).toLowerCase() : "";
    if (snapshot.type === "TEXT") return inferTextFunction(snapshot, context);
    if (/modal|dialog|drawer|sheet|overlay|popover/.test(name)) return "overlay";
    if (/navigation|nav bar|tab bar|bottom nav|dock/.test(parentName)) return "navigation";
    if (isPersistentComponent(snapshot, context)) return "navigation";
    if (/navigation|navbar|nav bar|tab bar|tabs|breadcrumb|menu|dock/.test(name)) return "navigation";
    if (/header|top bar|app bar|status bar/.test(name)) return "header";
    if (/footer/.test(name)) return "footer";
    if (/form|input|field|search|select|checkbox|radio|switch|textarea/.test(name)) return "form";
    if (/^(search|cari)\b/i.test(descendantText) && isCompactRelativeToParent(snapshot, context.parent)) return "form";
    if (isActionNode(snapshot, descendantText, context)) return "action";
    if (snapshot.type === "COLLECTION") return "collection";
    if (/image|photo|avatar|thumbnail|illustration|video|media/.test(name) || snapshotHasImageFill(snapshot)) return "media";
    if (snapshot.type === "INSTANCE" && !shouldExpandCompositeInstance(snapshot, context)) return "content";
    if (context.depth === 0 && isLargeRelativeToParent(snapshot, context.parent)) return "section";
    if (snapshot.children?.length) return context.depth === 0 ? "section" : "subsection";
    return "content";
  }
  function inferTextFunction(snapshot, context) {
    const name = stripNamingConvention(snapshot.name).toLowerCase();
    const text = readSnapshotText(snapshot);
    const fontWeight = getNumericProp(snapshot, "fontWeight");
    const fontSize = getNumericProp(snapshot, "fontSize");
    const siblingSizes = context.siblings.filter((sibling) => sibling.type === "TEXT").map((sibling) => getNumericProp(sibling, "fontSize"));
    const isProminent = fontSize >= Math.max(18, ...siblingSizes);
    if (/title|heading|label|caption|eyebrow|subtitle/.test(name)) return "label";
    if (isProminent || fontWeight >= 600 && text.length <= 64) return "label";
    return "text";
  }
  function inferNodeLabel(snapshot, role, context, children) {
    const sourceName = stripNamingConvention(snapshot.name);
    const meaningfulName = !isLowInformationLayerName(sourceName);
    const descendantText = findFirstDescendantText(snapshot);
    if (role === "action") return inferActionLabel(sourceName, descendantText, meaningfulName);
    if (role === "navigation") return isPersistentComponent(snapshot, context) ? "Global navigation" : meaningfulName ? humanizeLayerName(sourceName) : "Navigation";
    if (role === "collection") return inferCollectionLabel(snapshot, children);
    if (role === "label" || role === "text") {
      return inferTextLabel(snapshot, role, context, meaningfulName);
    }
    if (role === "form" && /^(search|cari)\b/i.test(descendantText)) return "Search field";
    const directHeading = findDirectHeadingText(snapshot);
    if (directHeading) return inferContainerLabelFromText(directHeading);
    if (role === "media") return meaningfulName ? humanizeLayerName(sourceName) : "Media content";
    if (meaningfulName) return inferContainerLabelFromName(sourceName);
    if (role === "section" && isLargeRelativeToParent(snapshot, context.parent)) return "Main content";
    const heading = findHeadingText(snapshot);
    if (heading) return inferContainerLabelFromText(heading);
    if (descendantText) return inferContainerLabelFromText(descendantText);
    if (role === "section") return `Main section ${context.index + 1}`;
    if (role === "subsection") return `Subsection ${context.index + 1}`;
    return getRoleFallbackLabel(role);
  }
  function inferActionLabel(sourceName, descendantText, meaningfulName) {
    const actionText = truncateSemanticLabel(descendantText);
    if (actionText) return `${cleanActionLabel(actionText)} action`;
    const sourceLabel = meaningfulName ? cleanActionLabel(sourceName) : "";
    return sourceLabel ? `${sourceLabel} action` : "Action";
  }
  function inferCollectionLabel(snapshot, children) {
    const collectionName = stripNamingConvention(snapshot.name);
    if (!isLowInformationLayerName(collectionName)) {
      return /collection$/i.test(collectionName) ? humanizeLayerName(collectionName) : `${humanizeLayerName(collectionName)} collection`;
    }
    const childLabels = children.map((child) => stripFunctionSuffix(child.label)).filter((label) => label && !/^subsection|content|item/i.test(label));
    const sharedLabel = findMostCommonValue(childLabels);
    if (sharedLabel) return `${sharedLabel} collection`;
    const firstSnapshot = snapshot.children?.[0];
    const firstVisibleText = firstSnapshot ? findFirstMeaningfulText(firstSnapshot) : "";
    if (firstVisibleText) return `${truncateSemanticLabel(firstVisibleText)} collection`;
    const firstSourceName = stripNamingConvention(firstSnapshot?.name || "");
    if (!isLowInformationLayerName(firstSourceName)) {
      return `${humanizeLayerName(firstSourceName)} collection`;
    }
    return snapshot.props.layoutMode === "HORIZONTAL" ? "Content collection" : "Content list";
  }
  function inferTextLabel(snapshot, role, context, meaningfulName) {
    const sourceName = stripNamingConvention(snapshot.name);
    const text = readSnapshotText(snapshot);
    if (text) return truncateSemanticLabel(text);
    if (meaningfulName) {
      const normalizedName = humanizeLayerName(sourceName);
      if (/^title$/i.test(normalizedName)) return context.depth <= 1 ? "Section title" : "Subsection title";
      return mapKnownSemanticLabel(normalizedName);
    }
    if (role === "label") {
      const fontSize = getNumericProp(snapshot, "fontSize");
      return context.depth <= 1 && fontSize >= 20 ? "Page title" : "Section label";
    }
    if (text.length >= 80) return "Body content";
    return "Text content";
  }
  function inferContainerLabelFromName(name) {
    const normalized = humanizeLayerName(name);
    if (/^title$/i.test(normalized)) return "Section title";
    if (/^content$/i.test(normalized)) return "Content";
    return normalized;
  }
  function inferContainerLabelFromText(text) {
    return truncateSemanticLabel(text);
  }
  function inferNodeConfidence(snapshot, label, role) {
    const sourceName = stripNamingConvention(snapshot.name);
    if (readSnapshotText(snapshot) || findDirectHeadingText(snapshot)) return "high";
    if (!isLowInformationLayerName(sourceName)) return "high";
    if (findFirstDescendantText(snapshot) || role === "collection" || role === "navigation") return "medium";
    return label === getRoleFallbackLabel(role) ? "low" : "medium";
  }
  function describeNodeFunction(role, label, sequence, childCount, persistent, repeatCount) {
    if (persistent) return `Persistent navigation available across screens with ${childCount} destinations.`;
    if (role === "collection") return `Repeated collection with ${repeatCount || childCount} ordered items.`;
    if (role === "action") return `Action control in position ${sequence}: ${stripFunctionSuffix(label)}.`;
    if (role === "label") return `Interface label in position ${sequence}.`;
    if (role === "text") return `Content text in position ${sequence}.`;
    if (role === "form") return `Input control in position ${sequence}.`;
    if (role === "section") return `Main screen section in position ${sequence}.`;
    if (role === "subsection") return `Nested content group in position ${sequence}.`;
    if (role === "media") return `Visual content in position ${sequence}.`;
    if (role === "overlay") return `Temporary content layered above the screen.`;
    return `Content item in position ${sequence}.`;
  }
  function isActionNode(snapshot, descendantText, context) {
    const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase();
    if (/button|cta|action|icon button|tertiary|secondary|primary/.test(name)) return true;
    if (/^icon\b/.test(name) && snapshot.children?.length) return true;
    if (!isActionText(descendantText) || !snapshot.children?.length) return false;
    const parentHeight = Math.max(context.parent?.height || snapshot.height, 1);
    return snapshot.height >= 20 && snapshot.height <= Math.min(104, parentHeight * 0.5);
  }
  function isPersistentComponent(snapshot, context) {
    const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase();
    if (/global nav|bottom nav|tab bar|navigation bar|app shell|dock/.test(name)) return true;
    const parent = context.parent;
    if (context.depth !== 0 || !parent || snapshot.props.layoutMode !== "HORIZONTAL") return false;
    const reachesBottom = snapshot.y + snapshot.height >= parent.height * 0.84;
    const spansScreen = snapshot.width >= parent.width * 0.7;
    return reachesBottom && spansScreen && (snapshot.children?.length || 0) >= 3;
  }
  function shouldExpandCompositeInstance(snapshot, context) {
    const componentName = typeof snapshot.props.componentName === "string" ? snapshot.props.componentName : snapshot.name;
    const name = humanizeLayerName(stripNamingConvention(componentName)).toLowerCase();
    if (/status bar|icon|button|field|input|card|tile|cell|avatar/.test(name)) return false;
    const meaningfulChildren = (snapshot.children || []).filter((child) => !isExcludedNode(child, Boolean(child.children?.length)));
    if (meaningfulChildren.length < 2) return false;
    if (isPersistentComponent(snapshot, context)) return true;
    if (/masthead|navigation|nav bar|tab bar|footer|carousel|main content/.test(name)) return true;
    const parent = context.parent;
    if (!parent || meaningfulChildren.length < 3) return false;
    const spansParent = snapshot.width >= parent.width * 0.72 || snapshot.height >= parent.height * 0.22;
    return spansParent;
  }
  function groupRepeatedSiblings(children, parent) {
    const parentName = humanizeLayerName(stripNamingConvention(parent.name)).toLowerCase();
    if (/navigation|nav bar|tab bar|shortcut|quick action|explore/.test(parentName)) return children;
    const signatureCounts = /* @__PURE__ */ new Map();
    children.forEach((child) => {
      const signature = createStructuralSignature(child);
      if (signature) signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    });
    const emittedSignatures = /* @__PURE__ */ new Set();
    return children.flatMap((child) => {
      const signature = createStructuralSignature(child);
      const repeatCount = signature ? signatureCounts.get(signature) || 0 : 0;
      if (!signature || repeatCount < 2) return [child];
      const matchingChildren = children.filter((candidate) => createStructuralSignature(candidate) === signature);
      if (!shouldGroupRepeatedSet(matchingChildren, parent)) return [child];
      if (emittedSignatures.has(signature)) return [];
      emittedSignatures.add(signature);
      const collectionName = inferRepeatedSiblingName(matchingChildren);
      const minX = Math.min(...matchingChildren.map((candidate) => candidate.x));
      const minY = Math.min(...matchingChildren.map((candidate) => candidate.y));
      const maxX = Math.max(...matchingChildren.map((candidate) => candidate.x + candidate.width));
      const maxY = Math.max(...matchingChildren.map((candidate) => candidate.y + candidate.height));
      return [{
        children: [child],
        height: maxY - minY,
        name: `${collectionName} collection`,
        props: {
          layoutMode: parent.props.layoutMode || "NONE",
          repeatCount
        },
        type: "COLLECTION",
        width: maxX - minX,
        x: minX,
        y: minY
      }];
    });
  }
  function shouldGroupRepeatedSet(siblings, parent) {
    const parentName = humanizeLayerName(stripNamingConvention(parent.name)).toLowerCase();
    if (/carousel|collection|grid|list|feed|cards|results|recommend/.test(parentName)) return true;
    const normalizedNames = siblings.map((sibling) => normalizeRepeatedName(sibling.name)).filter((name) => name && !isLowInformationLayerName(name));
    if (findMostCommonValue(normalizedNames)) return true;
    const genericNameCount = siblings.filter((sibling) => isLowInformationLayerName(stripNamingConvention(sibling.name))).length;
    return siblings.length >= 3 && genericNameCount >= Math.ceil(siblings.length * 0.66);
  }
  function createStructuralSignature(snapshot) {
    if (snapshot.type === "TEXT" || isExcludedNode(snapshot, Boolean(snapshot.children?.length))) return "";
    const childTypes = (snapshot.children || []).filter((child) => !excludedGeometryTypes.has(child.type)).map((child) => child.type).sort().join(",");
    const widthBucket = Math.round(snapshot.width / 24);
    const heightBucket = Math.round(snapshot.height / 24);
    return `${snapshot.type}:${widthBucket}:${heightBucket}:${childTypes}`;
  }
  function inferRepeatedSiblingName(siblings) {
    const meaningfulNames = siblings.map((sibling) => stripNamingConvention(sibling.name)).filter((name) => !isLowInformationLayerName(name)).map(normalizeRepeatedName).filter(Boolean);
    const commonName = findMostCommonValue(meaningfulNames);
    if (commonName) return humanizeLayerName(commonName);
    const visibleText = findMostCommonValue(siblings.map(findFirstMeaningfulText).filter(Boolean));
    return visibleText ? truncateSemanticLabel(visibleText) : "Content";
  }
  function normalizeRepeatedName(name) {
    return stripNamingConvention(name).replace(/\s*=\s*[^,]+/g, "").replace(/[\s_-]*\d+$/g, "").trim().toLowerCase();
  }
  function isLargeRelativeToParent(snapshot, parent) {
    if (!parent) return true;
    return snapshot.width >= parent.width * 0.55 || snapshot.height >= parent.height * 0.2;
  }
  function isCompactRelativeToParent(snapshot, parent) {
    if (!parent) return false;
    return snapshot.height <= parent.height * 0.2 && (snapshot.children?.length || 0) <= 2;
  }
  function sortSnapshotsByContentOrder(children, _parent) {
    const rowTolerance = Math.max(
      8,
      Math.min(...children.map((child) => Math.max(child.height, 1)), 24) * 0.35
    );
    return [...children].sort((left, right) => {
      const verticalDistance = left.y - right.y;
      if (Math.abs(verticalDistance) > rowTolerance) return verticalDistance;
      return left.x - right.x || verticalDistance || (left.siblingIndex || 0) - (right.siblingIndex || 0);
    });
  }
  function flattenSingleChildWrappers(node) {
    const children = renumberInformationArchitectureNodes(
      node.children.flatMap(flattenSingleChildWrappers)
    );
    const flattenedNode = { ...node, children };
    const isWrapper = (node.sourceType === "FRAME" || node.sourceType === "GROUP") && isLowInformationLayerName(stripNamingConvention(node.sourceName)) && children.length > 0;
    return isWrapper ? children : [flattenedNode];
  }
  function renumberInformationArchitectureNodes(nodes) {
    return nodes.map((node, index) => ({
      ...node,
      children: renumberInformationArchitectureNodes(node.children),
      sequence: index + 1
    }));
  }
  function pruneInformationArchitectureDepth(nodes, depth = 1) {
    return nodes.map((node) => ({
      ...node,
      children: depth >= maximumSemanticDepth ? [] : pruneInformationArchitectureDepth(node.children, depth + 1)
    }));
  }
  function assignSiblingActionPriorities(node) {
    const actions = node.children.filter((child) => child.role === "action");
    actions.forEach((action, index) => {
      const name = action.sourceName.toLowerCase();
      action.priority = name.includes("primary") || index === actions.length - 1 ? "primary" : "secondary";
    });
    node.children.forEach(assignSiblingActionPriorities);
  }
  function countInformationArchitectureNodes(nodes, predicate = () => true) {
    return nodes.reduce(
      (total, node) => total + (predicate(node) ? 1 : 0) + countInformationArchitectureNodes(node.children, predicate),
      0
    );
  }
  function isFlattenedPreviewSnapshot(snapshot) {
    return snapshotHasImageFill(snapshot) && countSnapshotTextNodes(snapshot) === 0 && (snapshot.children?.length || 0) === 0;
  }
  function countSnapshotTextNodes(snapshot) {
    const ownCount = snapshot.type === "TEXT" && readSnapshotText(snapshot) ? 1 : 0;
    return ownCount + (snapshot.children || []).reduce(
      (total, child) => total + countSnapshotTextNodes(child),
      0
    );
  }
  function readSnapshotText(snapshot) {
    const characters = snapshot.props.characters;
    if (typeof characters !== "string") return "";
    return characters.replace(/\s+/g, " ").trim().slice(0, 160);
  }
  function findFirstDescendantText(snapshot) {
    for (const child of sortSnapshotsByContentOrder(snapshot.children || [], snapshot)) {
      const text = readSnapshotText(child);
      if (text) return text;
      const nestedText = findFirstDescendantText(child);
      if (nestedText) return nestedText;
    }
    return "";
  }
  function findFirstMeaningfulText(snapshot) {
    return readSnapshotText(snapshot) || findFirstDescendantText(snapshot);
  }
  function findHeadingText(snapshot) {
    const candidates = collectTextSnapshots(snapshot).map((candidate) => ({
      fontSize: getNumericProp(candidate, "fontSize"),
      fontWeight: getNumericProp(candidate, "fontWeight"),
      text: readSnapshotText(candidate)
    })).filter((candidate) => candidate.text && !isActionText(candidate.text)).sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight);
    const heading = candidates[0];
    return heading && (heading.fontSize >= 18 || heading.fontWeight >= 600) ? heading.text : "";
  }
  function findDirectHeadingText(snapshot) {
    const candidates = (snapshot.children || []).filter((candidate) => candidate.type === "TEXT" && readSnapshotText(candidate)).map((candidate) => ({
      fontSize: getNumericProp(candidate, "fontSize"),
      fontWeight: getNumericProp(candidate, "fontWeight"),
      text: readSnapshotText(candidate)
    })).filter((candidate) => !isActionText(candidate.text)).sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight);
    const heading = candidates[0];
    return heading && (heading.fontSize >= 18 || heading.fontWeight >= 600) ? heading.text : "";
  }
  function collectTextSnapshots(snapshot, depth = 0) {
    if (depth > maximumTraversalDepth) return [];
    if (snapshot.type === "TEXT" && readSnapshotText(snapshot)) return [snapshot];
    return (snapshot.children || []).flatMap((child) => collectTextSnapshots(child, depth + 1));
  }
  function findMostCommonValue(values) {
    let result = "";
    let resultCount = 0;
    values.forEach((value) => {
      const count = values.filter((candidate) => normalizeForComparison(candidate) === normalizeForComparison(value)).length;
      if (count > resultCount) {
        result = value;
        resultCount = count;
      }
    });
    return resultCount >= 2 ? result : "";
  }
  function isActionText(value) {
    return /^(add|apply|back|buy|cancel|close|confirm|continue|delete|done|edit|go|next|open|order|pay|pull|remove|replace|retry|save|search|select|share|skip|submit|upload|view)\b/i.test(value.trim());
  }
  function isExcludedNode(snapshot, hasChildren) {
    const name = stripNamingConvention(snapshot.name);
    const hasText = Boolean(findFirstMeaningfulText(snapshot));
    const isMedia = snapshotHasImageFill(snapshot);
    const isMask = snapshot.props.isMask === true || /mask|clip\s*path/i.test(name);
    const isDecorative = /background|divider|shadow|decoration|decorative|scrim|shape/i.test(name);
    if (excludedGeometryTypes.has(snapshot.type) || isMask) return true;
    if (snapshot.type === "GROUP" && isDecorative) return true;
    if (!hasChildren && isDecorative && !hasText && !isMedia) return true;
    if (!hasChildren && isLowInformationLayerName(name) && !hasText && !isMedia) return true;
    return false;
  }
  function hasImageFill(value) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(hasImageFill);
    if (value.type === "IMAGE") return true;
    return Object.values(value).some(hasImageFill);
  }
  function snapshotHasImageFill(snapshot) {
    return snapshot.props.hasImageFill === true || hasImageFill(snapshot.props.fills);
  }
  function getNumericProp(snapshot, prop) {
    const value = snapshot.props[prop];
    return typeof value === "number" ? value : 0;
  }
  function stripNamingConvention(name) {
    return name.replace(/^(screen|section|subsection|header|navigation|form|action|text|content|collection)\s*\/\s*/i, "").trim();
  }
  function stripFunctionSuffix(name) {
    return name.replace(/\s+(action|collection|content|label|section|subsection)$/i, "").trim();
  }
  function mapKnownSemanticLabel(name) {
    const normalized = humanizeLayerName(name);
    if (/^screen category$/i.test(normalized)) return "Category label";
    if (/^screen title$/i.test(normalized)) return "Page title";
    return normalized;
  }
  function cleanActionLabel(name) {
    return humanizeLayerName(name).replace(/^(button|action|label|icon)\s+/i, "").replace(/\s+(primary|secondary|tertiary)$/i, "").replace(/\s+design$/i, "").trim();
  }
  function getRoleFallbackLabel(role) {
    const labels = {
      action: "Action",
      collection: "Collection",
      content: "Content",
      footer: "Footer",
      form: "Form",
      header: "Header",
      label: "Label",
      media: "Media content",
      navigation: "Navigation",
      overlay: "Overlay",
      section: "Main section",
      subsection: "Subsection",
      text: "Text content"
    };
    return labels[role];
  }
  function isLowInformationLayerName(name) {
    const normalized = name.trim();
    if (/^(random|untitled)(?:\s|#|-|_)*[a-z0-9]*$/i.test(normalized)) return true;
    return /^(actions|auto\s*layout|block|box|column|component|container|content|content\s*(grid|list)|ellipse|frame|group|instance|item|layer|layers|layout|node|object|preview\s*actions|rectangle|row|screen\s*details|section|shape|stack|text|vector|wrapper)(?:\s|#|-|_)*(?:[a-z]|copy(?:\s+\d+)?|\d+)?$/i.test(normalized);
  }
  function truncateSemanticLabel(value) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 44 ? `${normalized.slice(0, 41).trim()}...` : normalized;
  }
  function normalizeForComparison(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function humanizeLayerName(name) {
    const normalized = name.replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) return "Unnamed element";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  // apps/figma-plugin/src/supabase-records.ts
  var bucketName = "nexus-screen-previews";
  var tableName = "nexus_screens";
  function getSupabaseConfig() {
    const url = "https://aeyiwayubsfjbrwfreqn.supabase.co".trim().replace(/\/+$/, "");
    const key = "sb_publishable_FbGf2BFn5EOk3ztqv6HJ-Q_CdvqT1I3".trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild the plugin."
      );
    }
    return { key, url };
  }
  async function supabaseRequest(path, init = {}) {
    const { key, url } = getSupabaseConfig();
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...init.headers || {}
      }
    });
    const body = await response.text();
    if (!response.ok) {
      let message = body || `${response.status} ${response.statusText}`;
      try {
        const payload = JSON.parse(body);
        message = payload.message || payload.error || message;
      } catch {
      }
      throw new Error(message);
    }
    return body ? JSON.parse(body) : void 0;
  }
  async function loadDatabaseRecords() {
    const rows = await supabaseRequest(
      `/rest/v1/${tableName}?select=id,preview_url,record&order=updated_at.desc`
    );
    return rows.map((row) => ({
      ...row.record,
      previewImageDataUrl: row.preview_url || row.record.previewImageDataUrl || ""
    }));
  }
  async function saveDatabaseRecords(records) {
    const persistedRecords = await Promise.all(records.map(persistPreviewImage));
    const existingRows = await supabaseRequest(
      `/rest/v1/${tableName}?select=id,preview_url`
    );
    const retainedIds = new Set(persistedRecords.map((record) => record.id));
    const removedRows = existingRows.filter((row) => !retainedIds.has(row.id));
    if (removedRows.length > 0) {
      const previewPaths = removedRows.map((row) => getPreviewPath(row.preview_url)).filter((path) => Boolean(path));
      if (previewPaths.length > 0) {
        await supabaseRequest(`/storage/v1/object/${bucketName}`, {
          body: JSON.stringify({ prefixes: previewPaths }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE"
        });
      }
      await Promise.all(
        removedRows.map((row) => supabaseRequest(
          `/rest/v1/${tableName}?id=eq.${encodeURIComponent(row.id)}`,
          { method: "DELETE" }
        ))
      );
    }
    if (persistedRecords.length === 0) return persistedRecords;
    await supabaseRequest(`/rest/v1/${tableName}?on_conflict=id`, {
      body: JSON.stringify(persistedRecords.map((record) => ({
        app: record.app,
        created_at: record.createdAt,
        feature_name: record.featureName,
        id: record.id,
        preview_url: record.previewImageDataUrl || null,
        record,
        screen_name: record.screenName,
        source_node_url: record.sourceNodeUrl || null,
        status: record.status,
        team: record.team,
        updated_at: record.updatedAt
      }))),
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      method: "POST"
    });
    return persistedRecords;
  }
  async function persistPreviewImage(record) {
    if (!record.previewImageDataUrl.startsWith("data:")) return record;
    const preview = decodeDataUrl(record.previewImageDataUrl);
    const extension = preview.mimeType === "image/png" ? "png" : preview.mimeType === "image/webp" ? "webp" : "jpg";
    const path = `${record.id}.${extension}`;
    await supabaseRequest(`/storage/v1/object/${bucketName}/${encodeURIComponent(path)}`, {
      body: preview.bytes,
      headers: {
        "Cache-Control": "max-age=3600",
        "Content-Type": preview.mimeType,
        "x-upsert": "true"
      },
      method: "POST"
    });
    const { url } = getSupabaseConfig();
    return {
      ...record,
      previewImageDataUrl: `${url}/storage/v1/object/public/${bucketName}/${encodeURIComponent(path)}?v=${encodeURIComponent(record.updatedAt)}`
    };
  }
  function decodeDataUrl(dataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error("The exported preview is not a valid base64 image.");
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { bytes, mimeType: match[1] };
  }
  function getPreviewPath(previewUrl) {
    if (!previewUrl) return void 0;
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const markerIndex = previewUrl.indexOf(marker);
    if (markerIndex === -1) return void 0;
    const path = previewUrl.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
    return decodeURIComponent(path);
  }

  // apps/figma-plugin/src/code.ts
  figma.showUI(__html__, {
    height: 860,
    themeColors: true,
    width: 800
  });
  var metadataStorageKey = "nexus.screenRecords.v1";
  var legacyStorageClearedKey = "nexus.localRecordsCleared.v2";
  var sourceFileUrlPluginDataKey = "nexus.sourceFileUrl.v1";
  var storageTarget = {
    fileKey: "vWUo18fZOLZqCHtTG7fqb2",
    fileName: "Storage",
    fileUrl: "https://www.figma.com/design/vWUo18fZOLZqCHtTG7fqb2/Storage?node-id=0-1&t=54e6bBS005U4u6sk-1",
    teamId: "1678995985566215788",
    teamUrl: "https://www.figma.com/files/919358764484829204/team/1678995985566215788"
  };
  var textPaint = [solid("#202020")];
  var mutedPaint = [solid("#4c4c4c")];
  var greenPaint = solid("#008a0d");
  var maximumSnapshotDepth = 32;
  var maximumSnapshotNodes = 12e3;
  var snapshotProps = [
    "characters",
    "componentProperties",
    "fontSize",
    "fontWeight",
    "isMask",
    "layoutMode",
    "variantProperties",
    "visible"
  ];
  figma.on("selectionchange", postCurrentSelection);
  figma.ui.onmessage = async (message) => {
    if (message.type === "close") {
      figma.closePlugin();
      return;
    }
    if (message.type === "resize") {
      figma.ui.resize(message.width, message.height);
      return;
    }
    if (message.type === "notify") {
      figma.notify(message.message);
      return;
    }
    if (message.type === "open-source-url") {
      await safelyRun("open the source screen URL", async () => {
        figma.openExternal(message.sourceUrl);
        await incrementPullCount(message.recordId);
      });
      return;
    }
    if (message.type === "increment-view") {
      await incrementViewCount(message.recordId);
      return;
    }
    if (message.type === "get-records") {
      await safelyRun(
        "load saved screens",
        async () => {
          figma.ui.postMessage({
            records: await loadRecords(),
            type: "records-loaded"
          });
        },
        () => figma.ui.postMessage({ type: "records-load-failed" })
      );
      return;
    }
    if (message.type === "get-selection") {
      postCurrentSelection();
      return;
    }
    if (message.type === "push-screens") {
      await safelyRun(
        "push the selected screens",
        () => pushSelectedScreens(message),
        () => figma.ui.postMessage({ type: "push-screens-failed" })
      );
      return;
    }
    if (message.type === "remove-selection-node") {
      figma.currentPage.selection = figma.currentPage.selection.filter(
        (node) => node.id !== message.nodeId
      );
      postCurrentSelection();
      return;
    }
    if (message.type === "update-record") {
      await safelyRun(
        "update the stored screen",
        () => updateStoredScreen(message),
        () => figma.ui.postMessage({
          recordId: message.recordId,
          type: "record-update-failed"
        })
      );
      return;
    }
    if (message.type === "update-information-architecture") {
      await safelyRun(
        "save the information architecture",
        () => updateInformationArchitecture(message),
        () => figma.ui.postMessage({
          recordId: message.recordId,
          type: "information-architecture-save-failed"
        })
      );
      return;
    }
    if (message.type === "delete-record") {
      await safelyRun(
        "delete the stored screen",
        () => deleteStoredScreen(message.recordId),
        () => figma.ui.postMessage({
          recordIds: [message.recordId],
          type: "records-delete-failed"
        })
      );
      return;
    }
    if (message.type === "delete-records") {
      await safelyRun(
        "delete the selected screens",
        () => deleteStoredScreens(message.recordIds),
        () => figma.ui.postMessage({
          recordIds: message.recordIds,
          type: "records-delete-failed"
        })
      );
      return;
    }
    if (message.type === "replace-selection") {
      const [selected] = figma.currentPage.selection;
      if (!selected) {
        figma.notify("Select a frame to replace.", { error: true });
        return;
      }
      selected.name = `${message.title} - ${message.platform}`;
      figma.notify(`Updated selected frame with ${message.title}.`);
      return;
    }
    if (message.type === "insert-screen") {
      await safelyRun("insert the stored screen", async () => {
        await pullStoredScreen(message);
        await incrementPullCount(message.recordId);
        figma.notify(`Inserted ${message.title}.`);
      });
    }
  };
  async function safelyRun(action, task, onError) {
    try {
      await task();
    } catch (error) {
      onError?.();
      const details = getPluginErrorMessage(error);
      console.error(`[Asphalt Nexus] Could not ${action}`, error);
      figma.notify(`Could not ${action}: ${details}`, { error: true });
    }
  }
  function getPluginErrorMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim()) return error;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
    }
    try {
      const converted = String(error);
      return converted && converted !== "[object Object]" ? converted : "Figma rejected the operation without a message.";
    } catch {
      return "Figma rejected the operation without a message.";
    }
  }
  function getCurrentUserName() {
    try {
      return figma.currentUser?.name || "Unknown designer";
    } catch {
      return "Unknown designer";
    }
  }
  function postCurrentSelection() {
    const nodes = getSelectedPushableNodes().map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      url: createFigmaNodeUrl(node.id)
    }));
    console.log("[Asphalt Nexus] selection-changed", {
      fileKey: figma.fileKey,
      nodes
    });
    figma.ui.postMessage({
      nodes,
      type: "selection-changed"
    });
  }
  async function pushSelectedScreens(message) {
    const selectedNodes = new Map(getSelectedPushableNodes().map((node) => [node.id, node]));
    if (message.screens.length === 0) {
      throw new Error("Select at least one frame before submitting.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const isStoragePush = isRunningInStorageFile();
    const createdByName = getCurrentUserName();
    const newRecords = [];
    let refinedLayerCount = 0;
    for (const screen of message.screens) {
      const selected = selectedNodes.get(screen.nodeId);
      if (!selected) {
        throw new Error(`The selection changed before ${screen.screenName} could be pushed.`);
      }
      const sourceNodeMetadata = await runScreenPushStage(screen.screenName, "reading its source metadata", () => ({
        deviceSize: getNodeSize(selected),
        id: selected.id,
        name: selected.name,
        type: selected.type
      }));
      const sourceNodeUrl = createSourceNodeUrl(screen.sourceUrl, sourceNodeMetadata.id);
      if (!sourceNodeUrl) {
        throw new Error(`A Figma URL is missing for ${screen.screenName}.`);
      }
      rememberCurrentFileUrl(sourceNodeUrl);
      const recordId = createId();
      const nodeSnapshot = await runScreenPushStage(screen.screenName, "reading its layer structure", () => serializeNode(selected));
      const informationArchitecture = await runScreenPushStage(screen.screenName, "generating its IA", () => generateInformationArchitecture(screen.screenName, nodeSnapshot, now));
      const layerNameRefinements = await runScreenPushStage(screen.screenName, "refining its layer names", () => isFlattenedPreviewSnapshot(nodeSnapshot) ? [] : refineSelectedLayerNames(selected, screen.screenName));
      refinedLayerCount += layerNameRefinements.length;
      const previewImageDataUrl = await runScreenPushStage(screen.screenName, "exporting its preview", () => exportNodePreview(selected));
      const resource = isStoragePush ? await runScreenPushStage(screen.screenName, "creating its storage component", () => createEditableStorageResource(
        selected,
        {
          featureName: message.featureName,
          screenName: screen.screenName,
          team: message.team
        },
        recordId
      )) : { componentKey: void 0, nodeId: void 0 };
      newRecords.push({
        app: message.app,
        componentKey: resource.componentKey,
        createdAt: now,
        createdByName,
        deviceSize: sourceNodeMetadata.deviceSize,
        featureName: message.featureName,
        id: recordId,
        informationArchitecture,
        layerNameRefinements,
        nodeSnapshot,
        previewImageDataUrl,
        pullCount: 0,
        screenName: screen.screenName,
        tags: screen.tags || [],
        sourceFileKey: figma.fileKey,
        sourceFileName: figma.root.name,
        sourceNodeId: sourceNodeMetadata.id,
        sourceNodeName: sourceNodeMetadata.name,
        sourceNodeType: sourceNodeMetadata.type,
        sourceNodeUrl,
        status: isStoragePush ? "stored" : "pending_storage",
        storageFileKey: isStoragePush ? figma.fileKey : storageTarget.fileKey,
        storageFileName: storageTarget.fileName,
        storageFileUrl: storageTarget.fileUrl,
        storageNodeId: resource.nodeId,
        storagePageName: message.featureName,
        storageTargetTeamId: storageTarget.teamId,
        storageTargetTeamUrl: storageTarget.teamUrl,
        team: message.team,
        updatedAt: now,
        viewCount: 0
      });
    }
    console.log("[Asphalt Nexus] bulk push saved", newRecords.map((record) => ({
      recordId: record.id,
      screenName: record.screenName,
      sourceNodeId: record.sourceNodeId,
      sourceNodeUrl: record.sourceNodeUrl
    })));
    const records = await loadRecords();
    await runScreenPushStage("Selected screens", "saving metadata", () => saveRecords([...newRecords, ...records]));
    figma.ui.postMessage({ records: newRecords, type: "records-upserted" });
    figma.notify(
      `Refined ${refinedLayerCount} ${refinedLayerCount === 1 ? "layer name" : "layer names"} and saved ${newRecords.length} ${newRecords.length === 1 ? "screen" : "screens"}.`
    );
  }
  async function runScreenPushStage(screenName, stage, task) {
    try {
      return await task();
    } catch (error) {
      throw new Error(`${screenName} failed while ${stage}: ${getPluginErrorMessage(error)}`);
    }
  }
  async function updateStoredScreen(message) {
    const records = await loadRecords();
    const existing = records.find((record) => record.id === message.recordId);
    if (!existing) {
      throw new Error("Stored screen record was not found.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const metadataRecord = {
      ...existing,
      app: message.app,
      featureName: message.featureName,
      screenName: message.screenName,
      tags: message.tags,
      team: message.team,
      updatedAt: now
    };
    if (!message.replacement) {
      const savedRecords2 = await saveRecords(records.map((record) => record.id === message.recordId ? metadataRecord : record));
      const savedRecord2 = savedRecords2.find((record) => record.id === message.recordId) || metadataRecord;
      figma.ui.postMessage({ record: savedRecord2, type: "record-updated" });
      figma.notify(`Updated ${message.screenName}.`);
      return;
    }
    const selectedNodes = getSelectedPushableNodes();
    const selected = selectedNodes.length === 1 && selectedNodes[0].id === message.replacement.nodeId ? selectedNodes[0] : null;
    if (!selected) {
      throw new Error("Select exactly one frame, component, or instance to update the source.");
    }
    await loadAllPages();
    removeStorageNode(existing.storageNodeId);
    const isStoragePush = isRunningInStorageFile();
    const sourceNodeMetadata = {
      deviceSize: getNodeSize(selected),
      id: selected.id,
      name: selected.name,
      type: selected.type
    };
    const nodeSnapshot = serializeNode(selected);
    const informationArchitecture = message.replacement.keepInformationArchitecture ? existing.informationArchitecture : generateInformationArchitecture(message.screenName, nodeSnapshot, now);
    const layerNameRefinements = isFlattenedPreviewSnapshot(nodeSnapshot) ? [] : refineSelectedLayerNames(selected, message.screenName);
    const previewImageDataUrl = await exportNodePreview(selected);
    const resource = isStoragePush ? await createEditableStorageResource(selected, message, message.recordId) : { componentKey: void 0, nodeId: void 0 };
    const nextRecord = {
      ...metadataRecord,
      componentKey: resource.componentKey,
      deviceSize: sourceNodeMetadata.deviceSize,
      informationArchitecture,
      layerNameRefinements,
      nodeSnapshot,
      previewImageDataUrl,
      sourceFileKey: figma.fileKey,
      sourceFileName: figma.root.name,
      sourceNodeId: sourceNodeMetadata.id,
      sourceNodeName: sourceNodeMetadata.name,
      sourceNodeType: sourceNodeMetadata.type,
      sourceNodeUrl: createSourceNodeUrl(
        message.replacement.sourceUrl,
        sourceNodeMetadata.id
      ) || existing.sourceNodeUrl,
      status: isStoragePush ? "stored" : "pending_storage",
      storageFileKey: isStoragePush ? figma.fileKey : storageTarget.fileKey,
      storageFileName: storageTarget.fileName,
      storageFileUrl: storageTarget.fileUrl,
      storageNodeId: resource.nodeId,
      storagePageName: message.featureName
    };
    console.log("[Asphalt Nexus] update-record saved", {
      recordId: nextRecord.id,
      screenName: nextRecord.screenName,
      sourceFileKey: nextRecord.sourceFileKey,
      sourceNodeId: nextRecord.sourceNodeId,
      sourceNodeUrl: nextRecord.sourceNodeUrl
    });
    const savedRecords = await saveRecords(records.map((record) => record.id === message.recordId ? nextRecord : record));
    const savedRecord = savedRecords.find((record) => record.id === message.recordId) || nextRecord;
    figma.ui.postMessage({ record: savedRecord, type: "record-updated" });
    figma.notify(isStoragePush ? `Updated ${message.screenName}.` : `Updated ${message.screenName} as pending storage.`);
  }
  async function updateInformationArchitecture(message) {
    const records = await loadRecords();
    const existing = records.find((record) => record.id === message.recordId);
    if (!existing) {
      throw new Error("The screen record was not found.");
    }
    const nextRecord = {
      ...existing,
      informationArchitecture: message.informationArchitecture,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveRecords(records.map((record) => record.id === message.recordId ? nextRecord : record));
    figma.ui.postMessage({ record: nextRecord, type: "record-upserted" });
    figma.ui.postMessage({
      recordId: nextRecord.id,
      type: "information-architecture-saved"
    });
    figma.notify("Saved information architecture changes.");
  }
  async function deleteStoredScreen(recordId) {
    const records = await loadRecords();
    const existing = records.find((record) => record.id === recordId);
    if (!existing) {
      throw new Error("Stored screen record was not found.");
    }
    await loadAllPages();
    removeStorageNode(existing.storageNodeId);
    await saveRecords(records.filter((record) => record.id !== recordId));
    figma.ui.postMessage({ recordId, type: "record-deleted" });
    figma.notify(`Deleted ${existing.screenName} from Nexus metadata.`);
  }
  async function deleteStoredScreens(recordIds) {
    const targetIds = new Set(recordIds);
    const records = await loadRecords();
    const existingRecords = records.filter((record) => targetIds.has(record.id));
    if (existingRecords.length === 0) {
      throw new Error("The selected screen records were not found.");
    }
    await loadAllPages();
    existingRecords.forEach((record) => removeStorageNode(record.storageNodeId));
    await saveRecords(records.filter((record) => !targetIds.has(record.id)));
    figma.ui.postMessage({
      recordIds: existingRecords.map((record) => record.id),
      type: "records-deleted"
    });
    figma.notify(
      `Deleted ${existingRecords.length} ${existingRecords.length === 1 ? "screen" : "screens"} from Nexus metadata.`
    );
  }
  async function incrementPullCount(recordId) {
    if (!recordId) return;
    const records = await loadRecords();
    const existing = records.find((record) => record.id === recordId);
    if (!existing) return;
    const nextRecord = {
      ...existing,
      pullCount: (existing.pullCount || 0) + 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveRecords(records.map((record) => record.id === recordId ? nextRecord : record));
    figma.ui.postMessage({ record: nextRecord, type: "record-counts-updated" });
  }
  async function incrementViewCount(recordId) {
    const records = await loadRecords();
    const existing = records.find((record) => record.id === recordId);
    if (!existing) return;
    const nextRecord = {
      ...existing,
      viewCount: (existing.viewCount || 0) + 1
    };
    await saveRecords(records.map((record) => record.id === recordId ? nextRecord : record));
    figma.ui.postMessage({ record: nextRecord, type: "record-counts-updated" });
  }
  async function pullStoredScreen(message) {
    const node = findStorageNode(message.storageNodeId);
    if (isComponentNode(node)) {
      const instance = node.createInstance();
      figma.currentPage.appendChild(instance);
      const detached = instance.detachInstance();
      placePulledNode(detached);
      return detached;
    }
    if (message.componentKey && figma.importComponentByKeyAsync) {
      try {
        const component = await figma.importComponentByKeyAsync(message.componentKey);
        const instance = component.createInstance();
        figma.currentPage.appendChild(instance);
        const detached = instance.detachInstance();
        placePulledNode(detached);
        return detached;
      } catch {
        figma.notify("Could not import the stored component. Make sure the storage file library is published and accessible.", { error: true });
      }
    }
    throw new Error("This screen is not stored as an editable component yet.");
  }
  async function createEditableStorageResource(selected, message, recordId, options = {}) {
    await loadAllPages();
    const page = findOrCreatePage(message.featureName);
    const section = findOrCreateSection(page, message.team);
    const clone = options.cloneSource === false ? selected : selected.clone?.();
    if (!clone || !figma.createComponentFromNode) {
      figma.notify("This Figma version cannot create a component from the selected node.", { error: true });
      return { componentKey: void 0, nodeId: void 0 };
    }
    const component = figma.createComponentFromNode(clone);
    component.name = `${message.team}/${message.screenName}`;
    component.setPluginData?.("nexusRecordId", recordId);
    component.setPluginData?.("nexusTeam", message.team);
    component.setPluginData?.("nexusFeature", message.featureName);
    component.setPluginData?.("nexusScreenName", message.screenName);
    const container = section || page;
    container.appendChild(component);
    const itemIndex = Math.max(0, (container.children?.length || 1) - 1);
    component.x = 32 + itemIndex % 4 * 460;
    component.y = 96 + Math.floor(itemIndex / 4) * 960;
    return {
      componentKey: component.key,
      nodeId: component.id
    };
  }
  function refineSelectedLayerNames(root, screenName) {
    const refinements = [];
    const normalizedScreenName = screenName.replace(/^screen\s*\/\s*/i, "").trim() || "Untitled";
    let visitedNodes = 0;
    applyLayerNameRefinement(
      root,
      `Screen / ${normalizedScreenName}`,
      "Selected upload frame",
      1,
      refinements
    );
    const visit = (node, parent, depth) => {
      if (depth > 8 || visitedNodes >= 300) return;
      visitedNodes += 1;
      try {
        if (isGenericFigmaLayerName(node.name)) {
          const suggestion = suggestLayerName(node, parent);
          if (suggestion && suggestion.confidence >= 0.85) {
            applyLayerNameRefinement(
              node,
              suggestion.name,
              suggestion.reason,
              suggestion.confidence,
              refinements
            );
          }
        }
        getSceneNodeChildren(node).forEach((child) => visit(child, node, depth + 1));
      } catch (error) {
        console.warn("[Asphalt Nexus] Skipped an unavailable layer during refinement", error);
      }
    };
    getSceneNodeChildren(root).forEach((child) => visit(child, root, 1));
    return refinements;
  }
  function suggestLayerName(node, parent) {
    const text = readSceneNodeText(node) || findFirstSceneNodeText(node);
    const shortText = truncateLayerLabel(text);
    const searchableText = text.toLowerCase();
    const children = getSceneNodeChildren(node);
    const descendantTexts = findSceneNodeTexts(node);
    const actionTexts = descendantTexts.filter(isActionOrNavigationText);
    const actionBranches = children.filter((child) => findSceneNodeTexts(child).some(isActionOrNavigationText)).length;
    const textBranches = children.filter((child) => Boolean(findFirstSceneNodeText(child))).length;
    const parentHeight = Math.max(parent.height || 0, 1);
    const nearTop = node.y <= parentHeight * 0.18;
    const belongsDirectlyToScreen = /^screen\s*\//i.test(parent.name);
    if (node.type === "TEXT" && shortText) {
      return { confidence: 0.98, name: `Text / ${shortText}`, reason: "Visible text content" };
    }
    if (belongsDirectlyToScreen && actionBranches >= 2) {
      return {
        confidence: 0.94,
        name: "Section / Actions",
        reason: "Multiple action-shaped sibling groups"
      };
    }
    if (belongsDirectlyToScreen && isRepeatedSceneNodeCollection(node)) {
      const layoutMode = node.layoutMode;
      return {
        confidence: 0.92,
        name: `Content / Content ${layoutMode === "HORIZONTAL" ? "grid" : "list"}`,
        reason: "Repeated sibling structures with similar dimensions"
      };
    }
    if (belongsDirectlyToScreen && actionTexts.length === 0 && textBranches >= 2) {
      const prominentText = truncateLayerLabel(findProminentSceneNodeText(node) || shortText);
      return {
        confidence: 0.9,
        name: `${nearTop ? "Header" : "Content"} / ${prominentText || "Text content"}`,
        reason: "Prominent text hierarchy near the screen root"
      };
    }
    if (actionTexts.length === 1 && children.length > 0 && isLikelyCompactControl(node, parent)) {
      return {
        confidence: 0.93,
        name: `Action / ${truncateLayerLabel(actionTexts[0])}`,
        reason: "Compact container with action-oriented copy"
      };
    }
    if (/search|cari/.test(searchableText)) {
      return { confidence: 0.96, name: "Form / Search", reason: "Search copy and container structure" };
    }
    if (isActionOrNavigationText(text)) {
      return { confidence: 0.94, name: `Action / ${shortText}`, reason: "Action-oriented visible text" };
    }
    if (isLikelySceneNodeBottomNavigation(node, parent, descendantTexts)) {
      return { confidence: 0.92, name: "Navigation / Bottom", reason: "Navigation copy at the bottom of its container" };
    }
    if (nearTop && shortText && children.length > 0) {
      return { confidence: 0.88, name: `Header / ${shortText}`, reason: "Prominent container near the top" };
    }
    if (shortText && children.length > 0) {
      return { confidence: 0.86, name: `Section / ${shortText}`, reason: "Container grouped around visible copy" };
    }
    return null;
  }
  function findSceneNodeTexts(node, depth = 0) {
    if (depth > 4) return [];
    const ownText = readSceneNodeText(node);
    if (ownText) return [ownText];
    return getSceneNodeChildren(node).flatMap((child) => findSceneNodeTexts(child, depth + 1));
  }
  function findProminentSceneNodeText(node) {
    const candidates = findSceneNodeTextCandidates(node).filter((candidate) => !isActionOrNavigationText(candidate.text)).sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight);
    return candidates[0]?.text || "";
  }
  function findSceneNodeTextCandidates(node, depth = 0) {
    if (depth > 5) return [];
    const source = node;
    const text = readSceneNodeText(node);
    if (text) {
      return [{
        fontSize: typeof source.fontSize === "number" ? source.fontSize : 0,
        fontWeight: typeof source.fontWeight === "number" ? source.fontWeight : 0,
        text
      }];
    }
    return getSceneNodeChildren(node).flatMap((child) => findSceneNodeTextCandidates(child, depth + 1));
  }
  function isActionOrNavigationText(value) {
    return /^(add|apply|back|buy|cancel|close|confirm|continue|delete|done|edit|go|next|open|order|pay|pull|remove|replace|retry|save|search|select|share|skip|submit|upload|view)\b/i.test(value.trim());
  }
  function isLikelyCompactControl(node, parent) {
    const height = node.height || 0;
    const width = node.width || 0;
    const parentHeight = Math.max(parent.height || 0, 1);
    const parentWidth = Math.max(parent.width || 0, 1);
    return height >= 24 && height <= Math.min(112, parentHeight * 0.45) && width >= 40 && width <= parentWidth;
  }
  function isLikelySceneNodeBottomNavigation(node, parent, descendantTexts) {
    const source = node;
    const parentHeight = Math.max(parent.height || 0, 1);
    const nearBottom = node.y + (node.height || 0) >= parentHeight * 0.82;
    const navigationLabels = descendantTexts.filter((value) => /^(activity|chat|explore|home|inbox|menu|orders?|profile|search|settings?)\b/i.test(value));
    return nearBottom && source.layoutMode === "HORIZONTAL" && getSceneNodeChildren(node).length >= 3 && navigationLabels.length >= 2;
  }
  function isRepeatedSceneNodeCollection(node) {
    const children = getSceneNodeChildren(node).filter((child) => child.type !== "TEXT");
    if (children.length < 3) return false;
    const signatures = children.map((child) => `${child.type}:${Math.round((child.width || 0) / 16)}:${Math.round((child.height || 0) / 16)}`);
    const largestRepeatedGroup = signatures.reduce((largest, signature) => Math.max(largest, signatures.filter((candidate) => candidate === signature).length), 0);
    return largestRepeatedGroup >= 3;
  }
  function applyLayerNameRefinement(node, refinedName, reason, confidence, refinements) {
    const originalName = node.name;
    if (originalName === refinedName) return;
    try {
      node.name = refinedName;
      refinements.push({
        confidence,
        nodeId: node.id,
        originalName,
        reason,
        refinedName
      });
    } catch {
    }
  }
  function getSceneNodeChildren(node) {
    try {
      return node.children || [];
    } catch {
      return [];
    }
  }
  function readSceneNodeText(node) {
    try {
      const characters = node.characters;
      return typeof characters === "string" ? characters.replace(/\s+/g, " ").trim() : "";
    } catch {
      return "";
    }
  }
  function findFirstSceneNodeText(node, depth = 0) {
    if (depth > 4) return "";
    for (const child of getSceneNodeChildren(node)) {
      const text = readSceneNodeText(child);
      if (text) return text;
      const nestedText = findFirstSceneNodeText(child, depth + 1);
      if (nestedText) return nestedText;
    }
    return "";
  }
  function isGenericFigmaLayerName(name) {
    return /^(actions|auto\s*layout|block|box|column|component|container|content|content\s*(grid|list)|ellipse|frame|group|instance|item|layer|layers|layout|object|preview\s*actions|rectangle|row|screen\s*details|section|shape|stack|text|vector|wrapper)(\s|#|-|_)*\d*$/i.test(name.trim());
  }
  function truncateLayerLabel(value) {
    if (!value) return "";
    return value.length > 44 ? `${value.slice(0, 41).trim()}...` : value;
  }
  function serializeNode(node, budget = { complete: true, remaining: maximumSnapshotNodes }, depth = 0, parentId, siblingIndex = 0) {
    const source = node;
    const props = {};
    budget.remaining -= 1;
    for (const prop of snapshotProps) {
      const value = readSerializableSnapshotProp(source, prop);
      if (value !== void 0) {
        props[prop] = value;
      }
    }
    const componentIdentity = readComponentIdentity(source);
    if (componentIdentity.id) props.componentId = componentIdentity.id;
    if (componentIdentity.name) props.componentName = componentIdentity.name;
    if (hasSceneNodeImageFill(source)) props.hasImageFill = true;
    const children = [];
    const sourceChildren = getSceneNodeChildren(node);
    if (depth < maximumSnapshotDepth && budget.remaining > 0) {
      for (let index = 0; index < sourceChildren.length; index += 1) {
        const child = sourceChildren[index];
        if (!shouldCaptureSnapshotNode(child)) continue;
        if (budget.remaining <= 0) {
          budget.complete = false;
          break;
        }
        try {
          children.push(serializeNode(child, budget, depth + 1, node.id, index));
        } catch (error) {
          budget.complete = false;
          console.warn("[Asphalt Nexus] Skipped an unavailable layer during snapshot", error);
        }
      }
    } else if (sourceChildren.some(shouldCaptureSnapshotNode)) {
      budget.complete = false;
    }
    if (depth === 0) props.snapshotComplete = budget.complete;
    return {
      children: children.length > 0 ? children : void 0,
      height: Math.round(node.height || 0),
      id: node.id,
      name: node.name,
      parentId,
      props,
      siblingIndex,
      type: node.type,
      width: Math.round(node.width || 0),
      x: Math.round(node.x || 0),
      y: Math.round(node.y || 0)
    };
  }
  function shouldCaptureSnapshotNode(node) {
    const source = node;
    const name = node.name.trim();
    const type = node.type;
    try {
      if (source.visible === false || source.isMask === true) return false;
    } catch {
      return false;
    }
    if (["BOOLEAN_OPERATION", "LINE", "POLYGON", "STAR", "VECTOR"].includes(type)) return false;
    if (/mask|clip\s*path|background|divider|shadow|decoration|decorative|scrim/i.test(name)) return false;
    const hasChildren = getSceneNodeChildren(node).length > 0;
    const hasText = Boolean(readSceneNodeText(node));
    const isImage = hasSceneNodeImageFill(source);
    if (!hasChildren && /^(ellipse|rectangle|shape|vector)(?:\s|#|-|_)*\d*$/i.test(name) && !hasText && !isImage) {
      return false;
    }
    return true;
  }
  function readComponentIdentity(source) {
    try {
      const mainComponent = source.mainComponent;
      return {
        id: typeof mainComponent?.id === "string" ? mainComponent.id : "",
        name: typeof mainComponent?.name === "string" ? mainComponent.name : ""
      };
    } catch {
      return { id: "", name: "" };
    }
  }
  function hasSceneNodeImageFill(source) {
    try {
      const fills = source.fills;
      return Array.isArray(fills) && fills.some((fill) => Boolean(fill) && typeof fill === "object" && "type" in fill && fill.type === "IMAGE");
    } catch {
      return false;
    }
  }
  function readSerializableSnapshotProp(source, prop) {
    try {
      return toSerializable(source[prop]);
    } catch {
      return void 0;
    }
  }
  function toSerializable(value, seen = /* @__PURE__ */ new WeakSet()) {
    if (value === void 0 || typeof value === "function" || typeof value === "symbol") return void 0;
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
    if (Array.isArray(value)) {
      return value.map((item) => toSerializable(item, seen)).filter((item) => item !== void 0);
    }
    if (typeof value === "object") {
      if (seen.has(value)) return void 0;
      seen.add(value);
      const output = {};
      for (const [key, item] of Object.entries(value)) {
        const serialized = toSerializable(item, seen);
        if (serialized !== void 0) {
          output[key] = serialized;
        }
      }
      return output;
    }
    return void 0;
  }
  function isRunningInStorageFile() {
    return figma.fileKey === storageTarget.fileKey;
  }
  async function loadAllPages() {
    await figma.loadAllPagesAsync?.();
  }
  function findOrCreatePage(teamName) {
    const safeName = sanitizeName(teamName || "Uncategorized");
    const existing = figma.root.children.find((page2) => page2.name === safeName);
    if (existing) return existing;
    const page = figma.createPage();
    page.name = safeName;
    return page;
  }
  function findOrCreateSection(page, featureName) {
    const safeName = sanitizeName(featureName || "Uncategorized");
    const existing = page.children.find((node) => node.type === "SECTION" && node.name === safeName);
    if (existing && isSectionNode(existing)) return existing;
    if (!figma.createSection) return page;
    const section = figma.createSection();
    section.name = safeName;
    section.resizeWithoutConstraints?.(1840, 1040);
    page.appendChild(section);
    section.x = 0;
    section.y = page.children.length * 1120;
    return section;
  }
  async function loadRecords() {
    await clearLegacyLocalRecords();
    const records = await loadDatabaseRecords();
    return records.map(ensureRecordSourceUrl);
  }
  async function saveRecords(records) {
    await clearLegacyLocalRecords();
    return saveDatabaseRecords(records);
  }
  async function clearLegacyLocalRecords() {
    const wasCleared = await figma.clientStorage.getAsync(legacyStorageClearedKey);
    if (wasCleared) return;
    await figma.clientStorage.setAsync(metadataStorageKey, []);
    await figma.clientStorage.setAsync(legacyStorageClearedKey, true);
  }
  function getSelectedPushableNodes() {
    const supportedTypes = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE"]);
    return figma.currentPage.selection.filter(
      (node) => supportedTypes.has(node.type) && Boolean(node.exportAsync)
    );
  }
  async function exportNodePreview(node) {
    const bytes = await node.exportAsync?.({
      constraint: { type: "WIDTH", value: 720 },
      format: "JPG"
    });
    if (!bytes) return "";
    return `data:image/jpeg;base64,${uint8ArrayToBase64(bytes)}`;
  }
  function getNodeSize(node) {
    const width = Math.round(node.width || 393);
    const height = Math.round(node.height || 852);
    return `${width}x${height}`;
  }
  function createSourceNodeUrl(sourceUrl, nodeId) {
    return addNodeIdToFigmaUrl(sourceUrl, nodeId) || createFigmaNodeUrl(nodeId);
  }
  function addNodeIdToFigmaUrl(sourceUrl, nodeId) {
    if (!sourceUrl?.trim()) return void 0;
    try {
      const url = new URL(sourceUrl.trim());
      url.searchParams.set("node-id", formatUrlNodeId(nodeId));
      return url.toString();
    } catch {
      return sourceUrl.trim();
    }
  }
  function ensureRecordSourceUrl(record) {
    if (record.sourceNodeUrl || !record.sourceFileKey || !record.sourceNodeId) return record;
    return {
      ...record,
      sourceNodeUrl: createFigmaFileNodeUrl(
        record.sourceFileKey,
        record.sourceFileName || "Figma",
        record.sourceNodeId
      )
    };
  }
  function createFigmaNodeUrl(nodeId) {
    if (figma.fileKey) {
      return createFigmaFileNodeUrl(figma.fileKey, figma.root.name, nodeId);
    }
    return addNodeIdToFigmaUrl(getRememberedCurrentFileUrl(), nodeId);
  }
  function rememberCurrentFileUrl(sourceUrl) {
    try {
      figma.root.setPluginData?.(sourceFileUrlPluginDataKey, sourceUrl);
    } catch {
    }
  }
  function getRememberedCurrentFileUrl() {
    try {
      return figma.root.getPluginData?.(sourceFileUrlPluginDataKey) || void 0;
    } catch {
      return void 0;
    }
  }
  function createFigmaFileNodeUrl(fileKey, fileName, nodeId) {
    const urlFileName = encodeURIComponent(sanitizeName(fileName).replace(/\s+/g, "-"));
    return `https://www.figma.com/design/${fileKey}/${urlFileName}?node-id=${formatUrlNodeId(nodeId)}`;
  }
  function formatUrlNodeId(nodeId) {
    return encodeURIComponent(nodeId.replace(/:/g, "-"));
  }
  function removeStorageNode(nodeId) {
    const node = findStorageNode(nodeId);
    node?.remove?.();
  }
  function findStorageNode(nodeId) {
    if (!nodeId || !figma.getNodeById) return null;
    return figma.getNodeById(nodeId);
  }
  function isComponentNode(node) {
    return Boolean(node && node.type === "COMPONENT" && "createInstance" in node);
  }
  function placePulledNode(node) {
    node.x = figma.viewport.center.x - Math.round((node.width || 393) / 2);
    node.y = figma.viewport.center.y - Math.round((node.height || 852) / 2);
    figma.viewport.scrollAndZoomIntoView([node]);
  }
  function createId() {
    return `screen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  function sanitizeName(value) {
    return value.trim().replace(/\s+/g, " ") || "Uncategorized";
  }
  function isSectionNode(node) {
    return node.type === "SECTION" && "appendChild" in node;
  }
  function uint8ArrayToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  function solid(hex) {
    const normalized = hex.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    return {
      color: { b, g, r },
      type: "SOLID"
    };
  }
})();
