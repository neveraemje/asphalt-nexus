const maximumTraversalDepth = 24
const maximumSemanticDepth = 4
const maximumIaElements = 180
const excludedGeometryTypes = new Set([
  "BOOLEAN_OPERATION",
  "LINE",
  "POLYGON",
  "STAR",
  "VECTOR",
])

type InformationArchitectureBuildContext = {
  depth: number
  index: number
  parent?: NodeSnapshot
  siblings: NodeSnapshot[]
}

// Generates IA using only hierarchy, labels, order, repetition, and inferred function.
export function generateInformationArchitecture(
  screenName: string,
  snapshot: NodeSnapshot | undefined,
  generatedAt: string
): ScreenInformationArchitecture {
  if (!snapshot) {
    return createEmptyInformationArchitecture(screenName, generatedAt)
  }

  if (snapshot.props.snapshotComplete === false) {
    return createUnavailableInformationArchitecture(
      screenName,
      generatedAt,
      "The saved Figma node subtree is incomplete. Re-push the screen to capture its complete semantic structure."
    )
  }

  if (isFlattenedPreviewSnapshot(snapshot)) {
    return createUnavailableInformationArchitecture(
      screenName,
      generatedAt,
      "The selected node exposes image pixels but no complete editable child structure. Select and push the original editable screen frame."
    )
  }

  const budget = { remaining: maximumIaElements }
  const rootChildren = groupRepeatedSiblings(
    sortSnapshotsByContentOrder(snapshot.children || [], snapshot),
    snapshot
  )
  const builtRegions = rootChildren
    .map((child, index) => buildInformationArchitectureNode(child, {
      depth: 0,
      index,
      parent: snapshot,
      siblings: rootChildren,
    }, budget))
    .filter((node): node is InformationArchitectureNode => Boolean(node))
  const regions = pruneInformationArchitectureDepth(
    renumberInformationArchitectureNodes(
      builtRegions.flatMap(flattenSingleChildWrappers)
    )
  )

  if (regions.length === 0) {
    const fallback = buildInformationArchitectureNode(snapshot, {
      depth: 0,
      index: 0,
      siblings: [snapshot],
    }, budget)
    if (fallback) {
      regions.push(...pruneInformationArchitectureDepth(
        renumberInformationArchitectureNodes(flattenSingleChildWrappers(fallback))
      ))
    }
  }

  regions.forEach(assignSiblingActionPriorities)

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
    version: 10,
  }
}

// Returns an empty node-only result when no saved Figma structure exists.
function createEmptyInformationArchitecture(
  screenName: string,
  generatedAt: string
): ScreenInformationArchitecture {
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
    version: 10,
  }
}

// Returns an unavailable result instead of mapping image pixels or a partial subtree.
function createUnavailableInformationArchitecture(
  screenName: string,
  generatedAt: string,
  coverageNote: string
): ScreenInformationArchitecture {
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
    version: 10,
  }
}

// Converts one Figma snapshot node into one ordered semantic tree item.
function buildInformationArchitectureNode(
  snapshot: NodeSnapshot,
  context: InformationArchitectureBuildContext,
  budget: { remaining: number }
): InformationArchitectureNode | null {
  if (context.depth > maximumTraversalDepth || budget.remaining <= 0 || snapshot.props.visible === false) {
    return null
  }

  const hasChildren = Boolean(snapshot.children?.length)
  if (isExcludedNode(snapshot, hasChildren)) return null

  budget.remaining -= 1
  const role = inferNodeFunction(snapshot, context)
  const orderedChildren = snapshot.type === "INSTANCE" && !shouldExpandCompositeInstance(snapshot, context)
    ? []
    : groupRepeatedSiblings(
      sortSnapshotsByContentOrder(snapshot.children || [], snapshot),
      snapshot
    )
  let children = orderedChildren
    .map((child, index) => buildInformationArchitectureNode(child, {
      depth: context.depth + 1,
      index,
      parent: snapshot,
      siblings: orderedChildren,
    }, budget))
    .filter((node): node is InformationArchitectureNode => Boolean(node))
  if (role === "action" && children.every((child) => child.role === "label" || child.role === "text")) {
    children = []
  }
  const label = inferNodeLabel(snapshot, role, context, children)
  const text = readSnapshotText(snapshot)
  const exampleValue = text && normalizeForComparison(label) !== normalizeForComparison(text)
    ? text
    : undefined
  const repeated = role === "collection"
  const persistent = role === "navigation" && isPersistentComponent(snapshot, context)
  const repeatCount = getNumericProp(snapshot, "repeatCount") || undefined

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
    sourceType: snapshot.type,
  }
}

// Infers the functional role of a node without assuming a screen template.
function inferNodeFunction(
  snapshot: NodeSnapshot,
  context: InformationArchitectureBuildContext
): InformationArchitectureRole {
  const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase()
  const descendantText = findFirstDescendantText(snapshot)
  const parentName = context.parent
    ? humanizeLayerName(stripNamingConvention(context.parent.name)).toLowerCase()
    : ""

  if (snapshot.type === "TEXT") return inferTextFunction(snapshot, context)
  if (/modal|dialog|drawer|sheet|overlay|popover/.test(name)) return "overlay"
  if (/navigation|nav bar|tab bar|bottom nav|dock/.test(parentName)) return "navigation"
  if (isPersistentComponent(snapshot, context)) return "navigation"
  if (/navigation|navbar|nav bar|tab bar|tabs|breadcrumb|menu|dock/.test(name)) return "navigation"
  if (/header|top bar|app bar|status bar/.test(name)) return "header"
  if (/footer/.test(name)) return "footer"
  if (/form|input|field|search|select|checkbox|radio|switch|textarea/.test(name)) return "form"
  if (/^(search|cari)\b/i.test(descendantText) && isCompactRelativeToParent(snapshot, context.parent)) return "form"
  if (isActionNode(snapshot, descendantText, context)) return "action"
  if (snapshot.type === "COLLECTION") return "collection"
  if (/image|photo|avatar|thumbnail|illustration|video|media/.test(name) || snapshotHasImageFill(snapshot)) return "media"
  if (snapshot.type === "INSTANCE" && !shouldExpandCompositeInstance(snapshot, context)) return "content"
  if (context.depth === 0 && isLargeRelativeToParent(snapshot, context.parent)) return "section"
  if (snapshot.children?.length) return context.depth === 0 ? "section" : "subsection"
  return "content"
}

// Classifies text as a functional label or content using naming and typography.
function inferTextFunction(
  snapshot: NodeSnapshot,
  context: InformationArchitectureBuildContext
): InformationArchitectureRole {
  const name = stripNamingConvention(snapshot.name).toLowerCase()
  const text = readSnapshotText(snapshot)
  const fontWeight = getNumericProp(snapshot, "fontWeight")
  const fontSize = getNumericProp(snapshot, "fontSize")
  const siblingSizes = context.siblings
    .filter((sibling) => sibling.type === "TEXT")
    .map((sibling) => getNumericProp(sibling, "fontSize"))
  const isProminent = fontSize >= Math.max(18, ...siblingSizes)

  if (/title|heading|label|caption|eyebrow|subtitle/.test(name)) return "label"
  if (isProminent || (fontWeight >= 600 && text.length <= 64)) return "label"
  return "text"
}

// Creates a semantic label from node naming, visible text, repetition, and inferred function.
function inferNodeLabel(
  snapshot: NodeSnapshot,
  role: InformationArchitectureRole,
  context: InformationArchitectureBuildContext,
  children: InformationArchitectureNode[]
) {
  const sourceName = stripNamingConvention(snapshot.name)
  const meaningfulName = !isLowInformationLayerName(sourceName)
  const descendantText = findFirstDescendantText(snapshot)

  if (role === "action") return inferActionLabel(sourceName, descendantText, meaningfulName)
  if (role === "navigation") return isPersistentComponent(snapshot, context)
    ? "Global navigation"
    : meaningfulName
      ? humanizeLayerName(sourceName)
      : "Navigation"
  if (role === "collection") return inferCollectionLabel(snapshot, children)
  if (role === "label" || role === "text") {
    return inferTextLabel(snapshot, role, context, meaningfulName)
  }
  if (role === "form" && /^(search|cari)\b/i.test(descendantText)) return "Search field"

  const directHeading = findDirectHeadingText(snapshot)
  if (directHeading) return inferContainerLabelFromText(directHeading)
  if (role === "media") return meaningfulName ? humanizeLayerName(sourceName) : "Media content"
  if (meaningfulName) return inferContainerLabelFromName(sourceName)
  if (role === "section" && isLargeRelativeToParent(snapshot, context.parent)) return "Main content"

  const heading = findHeadingText(snapshot)
  if (heading) return inferContainerLabelFromText(heading)
  if (descendantText) return inferContainerLabelFromText(descendantText)
  if (role === "section") return `Main section ${context.index + 1}`
  if (role === "subsection") return `Subsection ${context.index + 1}`
  return getRoleFallbackLabel(role)
}

// Converts a button or icon component into an action-oriented IA label.
function inferActionLabel(sourceName: string, descendantText: string, meaningfulName: boolean) {
  const actionText = truncateSemanticLabel(descendantText)
  if (actionText) return `${cleanActionLabel(actionText)} action`

  const sourceLabel = meaningfulName ? cleanActionLabel(sourceName) : ""
  return sourceLabel ? `${sourceLabel} action` : "Action"
}

// Names repeated siblings as a collection using their shared item name when available.
function inferCollectionLabel(snapshot: NodeSnapshot, children: InformationArchitectureNode[]) {
  const collectionName = stripNamingConvention(snapshot.name)
  if (!isLowInformationLayerName(collectionName)) {
    return /collection$/i.test(collectionName)
      ? humanizeLayerName(collectionName)
      : `${humanizeLayerName(collectionName)} collection`
  }

  const childLabels = children
    .map((child) => stripFunctionSuffix(child.label))
    .filter((label) => label && !/^subsection|content|item/i.test(label))
  const sharedLabel = findMostCommonValue(childLabels)

  if (sharedLabel) return `${sharedLabel} collection`

  const firstSnapshot = snapshot.children?.[0]
  const firstVisibleText = firstSnapshot ? findFirstMeaningfulText(firstSnapshot) : ""
  if (firstVisibleText) return `${truncateSemanticLabel(firstVisibleText)} collection`

  const firstSourceName = stripNamingConvention(firstSnapshot?.name || "")
  if (!isLowInformationLayerName(firstSourceName)) {
    return `${humanizeLayerName(firstSourceName)} collection`
  }
  return snapshot.props.layoutMode === "HORIZONTAL" ? "Content collection" : "Content list"
}

// Labels text by its explicit node name or its typographic function while preserving copy as the value.
function inferTextLabel(
  snapshot: NodeSnapshot,
  role: InformationArchitectureRole,
  context: InformationArchitectureBuildContext,
  meaningfulName: boolean
) {
  const sourceName = stripNamingConvention(snapshot.name)
  const text = readSnapshotText(snapshot)

  if (text) return truncateSemanticLabel(text)

  if (meaningfulName) {
    const normalizedName = humanizeLayerName(sourceName)
    if (/^title$/i.test(normalizedName)) return context.depth <= 1 ? "Section title" : "Subsection title"
    return mapKnownSemanticLabel(normalizedName)
  }

  if (role === "label") {
    const fontSize = getNumericProp(snapshot, "fontSize")
    return context.depth <= 1 && fontSize >= 20 ? "Page title" : "Section label"
  }
  if (text.length >= 80) return "Body content"
  return "Text content"
}

// Turns a meaningful container name into a section, subsection, or content label.
function inferContainerLabelFromName(name: string) {
  const normalized = humanizeLayerName(name)
  if (/^title$/i.test(normalized)) return "Section title"
  if (/^content$/i.test(normalized)) return "Content"
  return normalized
}

// Uses prominent visible copy to contextualize an otherwise unnamed container.
function inferContainerLabelFromText(text: string) {
  return truncateSemanticLabel(text)
}

// Marks labels derived from direct evidence higher than neutral structural fallbacks.
function inferNodeConfidence(
  snapshot: NodeSnapshot,
  label: string,
  role: InformationArchitectureRole
): "high" | "medium" | "low" {
  const sourceName = stripNamingConvention(snapshot.name)
  if (readSnapshotText(snapshot) || findDirectHeadingText(snapshot)) return "high"
  if (!isLowInformationLayerName(sourceName)) return "high"
  if (findFirstDescendantText(snapshot) || role === "collection" || role === "navigation") return "medium"
  return label === getRoleFallbackLabel(role) ? "low" : "medium"
}

// Describes where a node sits in the ordered semantic tree and what it does.
function describeNodeFunction(
  role: InformationArchitectureRole,
  label: string,
  sequence: number,
  childCount: number,
  persistent: boolean,
  repeatCount?: number
) {
  if (persistent) return `Persistent navigation available across screens with ${childCount} destinations.`
  if (role === "collection") return `Repeated collection with ${repeatCount || childCount} ordered items.`
  if (role === "action") return `Action control in position ${sequence}: ${stripFunctionSuffix(label)}.`
  if (role === "label") return `Interface label in position ${sequence}.`
  if (role === "text") return `Content text in position ${sequence}.`
  if (role === "form") return `Input control in position ${sequence}.`
  if (role === "section") return `Main screen section in position ${sequence}.`
  if (role === "subsection") return `Nested content group in position ${sequence}.`
  if (role === "media") return `Visual content in position ${sequence}.`
  if (role === "overlay") return `Temporary content layered above the screen.`
  return `Content item in position ${sequence}.`
}

// Detects explicit controls and compact component instances as actions.
function isActionNode(
  snapshot: NodeSnapshot,
  descendantText: string,
  context: InformationArchitectureBuildContext
) {
  const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase()
  if (/button|cta|action|icon button|tertiary|secondary|primary/.test(name)) return true
  if (/^icon\b/.test(name) && snapshot.children?.length) return true
  if (!isActionText(descendantText) || !snapshot.children?.length) return false

  const parentHeight = Math.max(context.parent?.height || snapshot.height, 1)
  return snapshot.height >= 20 && snapshot.height <= Math.min(104, parentHeight * 0.5)
}

// Detects persistent navigation components from naming or bottom-screen placement.
function isPersistentComponent(
  snapshot: NodeSnapshot,
  context: InformationArchitectureBuildContext
) {
  const name = humanizeLayerName(stripNamingConvention(snapshot.name)).toLowerCase()
  if (/global nav|bottom nav|tab bar|navigation bar|app shell|dock/.test(name)) return true

  const parent = context.parent
  if (context.depth !== 0 || !parent || snapshot.props.layoutMode !== "HORIZONTAL") return false
  const reachesBottom = snapshot.y + snapshot.height >= parent.height * 0.84
  const spansScreen = snapshot.width >= parent.width * 0.7
  return reachesBottom && spansScreen && (snapshot.children?.length || 0) >= 3
}

// Expands only large composite instances that function as semantic sections or navigation.
function shouldExpandCompositeInstance(
  snapshot: NodeSnapshot,
  context: InformationArchitectureBuildContext
) {
  const componentName = typeof snapshot.props.componentName === "string"
    ? snapshot.props.componentName
    : snapshot.name
  const name = humanizeLayerName(stripNamingConvention(componentName)).toLowerCase()
  if (/status bar|icon|button|field|input|card|tile|cell|avatar/.test(name)) return false

  const meaningfulChildren = (snapshot.children || []).filter((child) => (
    !isExcludedNode(child, Boolean(child.children?.length))
  ))
  if (meaningfulChildren.length < 2) return false
  if (isPersistentComponent(snapshot, context)) return true
  if (/masthead|navigation|nav bar|tab bar|footer|carousel|main content/.test(name)) return true

  const parent = context.parent
  if (!parent || meaningfulChildren.length < 3) return false
  const spansParent = snapshot.width >= parent.width * 0.72
    || snapshot.height >= parent.height * 0.22
  return spansParent
}

// Replaces structurally repeated siblings with one collection and one representative item.
function groupRepeatedSiblings(children: NodeSnapshot[], parent: NodeSnapshot) {
  const parentName = humanizeLayerName(stripNamingConvention(parent.name)).toLowerCase()
  if (/navigation|nav bar|tab bar|shortcut|quick action|explore/.test(parentName)) return children

  const signatureCounts = new Map<string, number>()

  children.forEach((child) => {
    const signature = createStructuralSignature(child)
    if (signature) signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1)
  })

  const emittedSignatures = new Set<string>()
  return children.flatMap((child) => {
    const signature = createStructuralSignature(child)
    const repeatCount = signature ? signatureCounts.get(signature) || 0 : 0
    if (!signature || repeatCount < 2) return [child]
    const matchingChildren = children.filter((candidate) => createStructuralSignature(candidate) === signature)
    if (!shouldGroupRepeatedSet(matchingChildren, parent)) return [child]
    if (emittedSignatures.has(signature)) return []

    emittedSignatures.add(signature)
    const collectionName = inferRepeatedSiblingName(matchingChildren)
    const minX = Math.min(...matchingChildren.map((candidate) => candidate.x))
    const minY = Math.min(...matchingChildren.map((candidate) => candidate.y))
    const maxX = Math.max(...matchingChildren.map((candidate) => candidate.x + candidate.width))
    const maxY = Math.max(...matchingChildren.map((candidate) => candidate.y + candidate.height))

    return [{
      children: [child],
      height: maxY - minY,
      name: `${collectionName} collection`,
      props: {
        layoutMode: parent.props.layoutMode || "NONE",
        repeatCount,
      },
      type: "COLLECTION",
      width: maxX - minX,
      x: minX,
      y: minY,
    }]
  })
}

// Distinguishes true repeated content from unrelated sections with similar geometry ok ok.
function shouldGroupRepeatedSet(siblings: NodeSnapshot[], parent: NodeSnapshot) {
  const parentName = humanizeLayerName(stripNamingConvention(parent.name)).toLowerCase()
  if (/carousel|collection|grid|list|feed|cards|results|recommend/.test(parentName)) return true

  const normalizedNames = siblings
    .map((sibling) => normalizeRepeatedName(sibling.name))
    .filter((name) => name && !isLowInformationLayerName(name))
  if (findMostCommonValue(normalizedNames)) return true

  const genericNameCount = siblings.filter((sibling) => (
    isLowInformationLayerName(stripNamingConvention(sibling.name))
  )).length
  return siblings.length >= 3 && genericNameCount >= Math.ceil(siblings.length * 0.66)
}

// Creates a structure signature while ignoring changing copy inside repeated items.
function createStructuralSignature(snapshot: NodeSnapshot) {
  if (snapshot.type === "TEXT" || isExcludedNode(snapshot, Boolean(snapshot.children?.length))) return ""
  const childTypes = (snapshot.children || [])
    .filter((child) => !excludedGeometryTypes.has(child.type))
    .map((child) => child.type)
    .sort()
    .join(",")
  const widthBucket = Math.round(snapshot.width / 24)
  const heightBucket = Math.round(snapshot.height / 24)
  return `${snapshot.type}:${widthBucket}:${heightBucket}:${childTypes}`
}

// Derives the shared item name for a synthetic collection.
function inferRepeatedSiblingName(siblings: NodeSnapshot[]) {
  const meaningfulNames = siblings
    .map((sibling) => stripNamingConvention(sibling.name))
    .filter((name) => !isLowInformationLayerName(name))
    .map(normalizeRepeatedName)
    .filter(Boolean)
  const commonName = findMostCommonValue(meaningfulNames)
  if (commonName) return humanizeLayerName(commonName)

  const visibleText = findMostCommonValue(siblings.map(findFirstMeaningfulText).filter(Boolean))
  return visibleText ? truncateSemanticLabel(visibleText) : "Content"
}

// Removes variant and numeric suffixes when comparing repeated sibling names.
function normalizeRepeatedName(name: string) {
  return stripNamingConvention(name)
    .replace(/\s*=\s*[^,]+/g, "")
    .replace(/[\s_-]*\d+$/g, "")
    .trim()
    .toLowerCase()
}

// Detects a large direct child that should be represented as a main screen section.
function isLargeRelativeToParent(snapshot: NodeSnapshot, parent?: NodeSnapshot) {
  if (!parent) return true
  return snapshot.width >= parent.width * 0.55 || snapshot.height >= parent.height * 0.2
}

// Detects compact controls so descendant action text does not classify an entire section as a form.
function isCompactRelativeToParent(snapshot: NodeSnapshot, parent?: NodeSnapshot) {
  if (!parent) return false
  return snapshot.height <= parent.height * 0.2
    && (snapshot.children?.length || 0) <= 2
}

// Sorts nodes top-to-bottom and then left-to-right, using source order as a stable fallback.
function sortSnapshotsByContentOrder(children: NodeSnapshot[], _parent: NodeSnapshot) {
  const rowTolerance = Math.max(
    8,
    Math.min(...children.map((child) => Math.max(child.height, 1)), 24) * 0.35
  )
  return [...children].sort((left, right) => {
    const verticalDistance = left.y - right.y
    if (Math.abs(verticalDistance) > rowTolerance) return verticalDistance
    return left.x - right.x
      || verticalDistance
      || (left.siblingIndex || 0) - (right.siblingIndex || 0)
  })
}

// Removes generic implementation wrappers while preserving all semantic children in order.
function flattenSingleChildWrappers(node: InformationArchitectureNode): InformationArchitectureNode[] {
  const children = renumberInformationArchitectureNodes(
    node.children.flatMap(flattenSingleChildWrappers)
  )
  const flattenedNode = { ...node, children }
  const isWrapper = (node.sourceType === "FRAME" || node.sourceType === "GROUP")
    && isLowInformationLayerName(stripNamingConvention(node.sourceName))
    && children.length > 0

  return isWrapper ? children : [flattenedNode]
}

// Restarts sequence numbers for the children of every semantic parent.
function renumberInformationArchitectureNodes(
  nodes: InformationArchitectureNode[]
): InformationArchitectureNode[] {
  return nodes.map((node, index) => ({
    ...node,
    children: renumberInformationArchitectureNodes(node.children),
    sequence: index + 1,
  }))
}

// Applies the display-depth limit after generic wrappers have been removed.
function pruneInformationArchitectureDepth(
  nodes: InformationArchitectureNode[],
  depth = 1
): InformationArchitectureNode[] {
  return nodes.map((node) => ({
    ...node,
    children: depth >= maximumSemanticDepth
      ? []
      : pruneInformationArchitectureDepth(node.children, depth + 1),
  }))
}

// Assigns primary and secondary action priority without changing hierarchy or order.
function assignSiblingActionPriorities(node: InformationArchitectureNode) {
  const actions = node.children.filter((child) => child.role === "action")

  actions.forEach((action, index) => {
    const name = action.sourceName.toLowerCase()
    action.priority = name.includes("primary") || index === actions.length - 1
      ? "primary"
      : "secondary"
  })

  node.children.forEach(assignSiblingActionPriorities)
}

// Counts generated tree nodes, optionally filtering by semantic role.
function countInformationArchitectureNodes(
  nodes: InformationArchitectureNode[],
  predicate: (node: InformationArchitectureNode) => boolean = () => true
): number {
  return nodes.reduce(
    (total, node) => total
      + (predicate(node) ? 1 : 0)
      + countInformationArchitectureNodes(node.children, predicate),
    0
  )
}

// Detects when the selected screen is an image with too little editable text structure for node IA.
export function isFlattenedPreviewSnapshot(snapshot: NodeSnapshot) {
  return snapshotHasImageFill(snapshot)
    && countSnapshotTextNodes(snapshot) === 0
    && (snapshot.children?.length || 0) === 0
}

// Counts editable text nodes beneath a Figma snapshot.
function countSnapshotTextNodes(snapshot: NodeSnapshot): number {
  const ownCount = snapshot.type === "TEXT" && readSnapshotText(snapshot) ? 1 : 0
  return ownCount + (snapshot.children || []).reduce(
    (total, child) => total + countSnapshotTextNodes(child),
    0
  )
}

// Reads normalized visible characters from a text snapshot.
function readSnapshotText(snapshot: NodeSnapshot) {
  const characters = snapshot.props.characters
  if (typeof characters !== "string") return ""
  return characters.replace(/\s+/g, " ").trim().slice(0, 160)
}

// Finds the first visible text in a node subtree using content order.
function findFirstDescendantText(snapshot: NodeSnapshot): string {
  for (const child of sortSnapshotsByContentOrder(snapshot.children || [], snapshot)) {
    const text = readSnapshotText(child)
    if (text) return text
    const nestedText = findFirstDescendantText(child)
    if (nestedText) return nestedText
  }
  return ""
}

// Returns the first user-facing text on a node or within its descendants.
function findFirstMeaningfulText(snapshot: NodeSnapshot) {
  return readSnapshotText(snapshot) || findFirstDescendantText(snapshot)
}

// Finds the strongest heading candidate inside an unnamed section.
function findHeadingText(snapshot: NodeSnapshot) {
  const candidates = collectTextSnapshots(snapshot)
    .map((candidate) => ({
      fontSize: getNumericProp(candidate, "fontSize"),
      fontWeight: getNumericProp(candidate, "fontWeight"),
      text: readSnapshotText(candidate),
    }))
    .filter((candidate) => candidate.text && !isActionText(candidate.text))
    .sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight)
  const heading = candidates[0]
  return heading && (heading.fontSize >= 18 || heading.fontWeight >= 600) ? heading.text : ""
}

// Finds prominent visible text attached directly to a semantic container.
function findDirectHeadingText(snapshot: NodeSnapshot) {
  const candidates = (snapshot.children || [])
    .filter((candidate) => candidate.type === "TEXT" && readSnapshotText(candidate))
    .map((candidate) => ({
      fontSize: getNumericProp(candidate, "fontSize"),
      fontWeight: getNumericProp(candidate, "fontWeight"),
      text: readSnapshotText(candidate),
    }))
    .filter((candidate) => !isActionText(candidate.text))
    .sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight)
  const heading = candidates[0]
  return heading && (heading.fontSize >= 18 || heading.fontWeight >= 600) ? heading.text : ""
}

// Collects editable text snapshots recursively for hierarchy inference.
function collectTextSnapshots(snapshot: NodeSnapshot, depth = 0): NodeSnapshot[] {
  if (depth > maximumTraversalDepth) return []
  if (snapshot.type === "TEXT" && readSnapshotText(snapshot)) return [snapshot]
  return (snapshot.children || []).flatMap((child) => collectTextSnapshots(child, depth + 1))
}

// Finds the most frequent meaningful label among repeated children.
function findMostCommonValue(values: string[]) {
  let result = ""
  let resultCount = 0

  values.forEach((value) => {
    const count = values.filter((candidate) => normalizeForComparison(candidate) === normalizeForComparison(value)).length
    if (count > resultCount) {
      result = value
      resultCount = count
    }
  })

  return resultCount >= 2 ? result : ""
}

// Detects action-oriented visible copy.
function isActionText(value: string) {
  return /^(add|apply|back|buy|cancel|close|confirm|continue|delete|done|edit|go|next|open|order|pay|pull|remove|replace|retry|save|search|select|share|skip|submit|upload|view)\b/i.test(value.trim())
}

// Excludes geometry, masks, decorative groups, and generic leaves with no semantic content.
function isExcludedNode(snapshot: NodeSnapshot, hasChildren: boolean) {
  const name = stripNamingConvention(snapshot.name)
  const hasText = Boolean(findFirstMeaningfulText(snapshot))
  const isMedia = snapshotHasImageFill(snapshot)
  const isMask = snapshot.props.isMask === true || /mask|clip\s*path/i.test(name)
  const isDecorative = /background|divider|shadow|decoration|decorative|scrim|shape/i.test(name)

  if (excludedGeometryTypes.has(snapshot.type) || isMask) return true
  if (snapshot.type === "GROUP" && isDecorative) return true
  if (!hasChildren && isDecorative && !hasText && !isMedia) return true
  if (!hasChildren && isLowInformationLayerName(name) && !hasText && !isMedia) return true
  return false
}

// Detects image paint data recursively.
function hasImageFill(value: SerializableValue | undefined): boolean {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some(hasImageFill)
  if (value.type === "IMAGE") return true
  return Object.values(value).some(hasImageFill)
}

// Supports both compact semantic snapshots and older snapshots containing full paint data.
function snapshotHasImageFill(snapshot: NodeSnapshot) {
  return snapshot.props.hasImageFill === true || hasImageFill(snapshot.props.fills)
}

// Reads a numeric serialized node property.
function getNumericProp(snapshot: NodeSnapshot, prop: string) {
  const value = snapshot.props[prop]
  return typeof value === "number" ? value : 0
}

// Removes semantic prefixes previously added by the refinement pipeline.
function stripNamingConvention(name: string) {
  return name.replace(/^(screen|section|subsection|header|navigation|form|action|text|content|collection)\s*\/\s*/i, "").trim()
}

// Removes function suffixes when deriving a shared collection item label.
function stripFunctionSuffix(name: string) {
  return name.replace(/\s+(action|collection|content|label|section|subsection)$/i, "").trim()
}

// Maps explicit design-layer terminology into product-facing IA terminology.
function mapKnownSemanticLabel(name: string) {
  const normalized = humanizeLayerName(name)
  if (/^screen category$/i.test(normalized)) return "Category label"
  if (/^screen title$/i.test(normalized)) return "Page title"
  return normalized
}

// Removes component and variant conventions from an action label.
function cleanActionLabel(name: string) {
  return humanizeLayerName(name)
    .replace(/^(button|action|label|icon)\s+/i, "")
    .replace(/\s+(primary|secondary|tertiary)$/i, "")
    .replace(/\s+design$/i, "")
    .trim()
}

// Returns the generic functional label for a node when no stronger context exists.
function getRoleFallbackLabel(role: InformationArchitectureRole) {
  const labels: Record<InformationArchitectureRole, string> = {
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
    text: "Text content",
  }
  return labels[role]
}

// Detects default or implementation-only names that do not communicate IA meaning.
function isLowInformationLayerName(name: string) {
  const normalized = name.trim()
  if (/^(random|untitled)(?:\s|#|-|_)*[a-z0-9]*$/i.test(normalized)) return true
  return /^(actions|auto\s*layout|block|box|column|component|container|content|content\s*(grid|list)|ellipse|frame|group|instance|item|layer|layers|layout|node|object|preview\s*actions|rectangle|row|screen\s*details|section|shape|stack|text|vector|wrapper)(?:\s|#|-|_)*(?:[a-z]|copy(?:\s+\d+)?|\d+)?$/i.test(normalized)
}

// Keeps generated semantic labels compact for the tree view.
function truncateSemanticLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 44 ? `${normalized.slice(0, 41).trim()}...` : normalized
}

// Normalizes labels for semantic comparisons.
function normalizeForComparison(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

// Converts Figma naming separators into a readable title.
function humanizeLayerName(name: string) {
  const normalized = name.replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return "Unnamed element"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
