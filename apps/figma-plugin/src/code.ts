import { generateInformationArchitecture, isFlattenedPreviewSnapshot } from "./ia"
import { loadDatabaseRecords, saveDatabaseRecords } from "./supabase-records"

figma.showUI(__html__, {
  height: 860,
  themeColors: true,
  width: 800,
})

const canvasFontFamily = "Rupa Sans App"
const metadataStorageKey = "nexus.screenRecords.v1"
const legacyStorageClearedKey = "nexus.localRecordsCleared.v2"
const sourceFileUrlPluginDataKey = "nexus.sourceFileUrl.v1"
const storageTarget = {
  fileKey: "vWUo18fZOLZqCHtTG7fqb2",
  fileName: "Storage",
  fileUrl: "https://www.figma.com/design/vWUo18fZOLZqCHtTG7fqb2/Storage?node-id=0-1&t=54e6bBS005U4u6sk-1",
  teamId: "1678995985566215788",
  teamUrl: "https://www.figma.com/files/919358764484829204/team/1678995985566215788",
}
const textPaint = [solid("#202020")]
const mutedPaint = [solid("#4c4c4c")]
const greenPaint = solid("#008a0d")
const maximumSnapshotDepth = 32
const maximumSnapshotNodes = 12_000
const snapshotProps = [
  "characters",
  "componentProperties",
  "fontSize",
  "fontWeight",
  "isMask",
  "layoutMode",
  "variantProperties",
  "visible",
] as const

type SnapshotBudget = {
  complete: boolean
  remaining: number
}

figma.on("selectionchange", postCurrentSelection)

// Handles messages sent from the React UI and maps them to Figma canvas actions.
figma.ui.onmessage = async (message: PluginMessage) => {
  if (message.type === "close") {
    figma.closePlugin()
    return
  }

  if (message.type === "resize") {
    figma.ui.resize(message.width, message.height)
    return
  }

  if (message.type === "notify") {
    figma.notify(message.message)
    return
  }

  if (message.type === "open-source-url") {
    await safelyRun("open the source screen URL", async () => {
      figma.openExternal(message.sourceUrl)
      await incrementPullCount(message.recordId)
    })
    return
  }

  if (message.type === "increment-view") {
    await incrementViewCount(message.recordId)
    return
  }

  if (message.type === "get-records") {
    await safelyRun(
      "load saved screens",
      async () => {
        figma.ui.postMessage({
          records: await loadRecords(),
          type: "records-loaded",
        } satisfies PluginToUiMessage)
      },
      () => figma.ui.postMessage({ type: "records-load-failed" } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "get-selection") {
    postCurrentSelection()
    return
  }

  if (message.type === "push-screens") {
    await safelyRun(
      "push the selected screens",
      () => pushSelectedScreens(message),
      () => figma.ui.postMessage({ type: "push-screens-failed" } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "remove-selection-node") {
    figma.currentPage.selection = figma.currentPage.selection.filter(
      (node) => node.id !== message.nodeId
    )
    postCurrentSelection()
    return
  }

  if (message.type === "update-record") {
    await safelyRun(
      "update the stored screen",
      () => updateStoredScreen(message),
      () => figma.ui.postMessage({
        recordId: message.recordId,
        type: "record-update-failed",
      } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "update-information-architecture") {
    await safelyRun(
      "save the information architecture",
      () => updateInformationArchitecture(message),
      () => figma.ui.postMessage({
        recordId: message.recordId,
        type: "information-architecture-save-failed",
      } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "delete-record") {
    await safelyRun(
      "delete the stored screen",
      () => deleteStoredScreen(message.recordId),
      () => figma.ui.postMessage({
        recordIds: [message.recordId],
        type: "records-delete-failed",
      } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "delete-records") {
    await safelyRun(
      "delete the selected screens",
      () => deleteStoredScreens(message.recordIds),
      () => figma.ui.postMessage({
        recordIds: message.recordIds,
        type: "records-delete-failed",
      } satisfies PluginToUiMessage)
    )
    return
  }

  if (message.type === "replace-selection") {
    const [selected] = figma.currentPage.selection
    if (!selected) {
      figma.notify("Select a frame to replace.", { error: true })
      return
    }

    selected.name = `${message.title} - ${message.platform}`
    figma.notify(`Updated selected frame with ${message.title}.`)
    return
  }

  if (message.type === "insert-screen") {
    await safelyRun("insert the stored screen", async () => {
      await pullStoredScreen(message)
      await incrementPullCount(message.recordId)
      figma.notify(`Inserted ${message.title}.`)
    })
  }
}

// Converts unexpected plugin failures into a Figma notification instead of leaving the UI with no feedback.
async function safelyRun(
  action: string,
  task: () => Promise<void>,
  onError?: () => void
) {
  try {
    await task()
  } catch (error) {
    onError?.()
    const details = getPluginErrorMessage(error)
    console.error(`[Asphalt Nexus] Could not ${action}`, error)
    figma.notify(`Could not ${action}: ${details}`, { error: true })
  }
}

// Preserves messages from Error objects, strings, symbols, and Figma's structured rejections.
function getPluginErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error.trim()) return error

  try {
    const serialized = JSON.stringify(error)
    if (serialized && serialized !== "{}") return serialized
  } catch {
    // Some Figma host values are not JSON serializable, so string conversion is the fallback.
  }

  try {
    const converted = String(error)
    return converted && converted !== "[object Object]" ? converted : "Figma rejected the operation without a message."
  } catch {
    return "Figma rejected the operation without a message."
  }
}

// Reads the Figma user name when the manifest permission is active, while keeping push usable without it.
function getCurrentUserName() {
  try {
    return figma.currentUser?.name || "Unknown designer"
  } catch {
    return "Unknown designer"
  }
}

// Sends every selected screen frame to the UI whenever the Figma selection changes.
function postCurrentSelection() {
  const nodes = getSelectedPushableNodes().map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    url: createFigmaNodeUrl(node.id),
  }))

  console.log("[Asphalt Nexus] selection-changed", {
    fileKey: figma.fileKey,
    nodes,
  })

  figma.ui.postMessage({
    nodes,
    type: "selection-changed",
  } satisfies PluginToUiMessage)
}

// Saves all selected Figma screens as individual Nexus records in one bulk operation.
async function pushSelectedScreens(message: PushScreensMessage) {
  const selectedNodes = new Map(getSelectedPushableNodes().map((node) => [node.id, node]))
  if (message.screens.length === 0) {
    throw new Error("Select at least one frame before submitting.")
  }

  const now = new Date().toISOString()
  const isStoragePush = isRunningInStorageFile()
  const createdByName = getCurrentUserName()
  const newRecords: ScreenRecord[] = []
  let refinedLayerCount = 0

  for (const screen of message.screens) {
    const selected = selectedNodes.get(screen.nodeId)
    if (!selected) {
      throw new Error(`The selection changed before ${screen.screenName} could be pushed.`)
    }

    const sourceNodeMetadata = await runScreenPushStage(screen.screenName, "reading its source metadata", () => ({
      deviceSize: getNodeSize(selected),
      id: selected.id,
      name: selected.name,
      type: selected.type,
    }))
    const sourceNodeUrl = createSourceNodeUrl(screen.sourceUrl, sourceNodeMetadata.id)
    if (!sourceNodeUrl) {
      throw new Error(`A Figma URL is missing for ${screen.screenName}.`)
    }
    rememberCurrentFileUrl(sourceNodeUrl)

    const recordId = createId()
    const nodeSnapshot = await runScreenPushStage(screen.screenName, "reading its layer structure", () => (
      serializeNode(selected)
    ))
    const informationArchitecture = await runScreenPushStage(screen.screenName, "generating its IA", () => (
      generateInformationArchitecture(screen.screenName, nodeSnapshot, now)
    ))
    const layerNameRefinements = await runScreenPushStage(screen.screenName, "refining its layer names", () => (
      isFlattenedPreviewSnapshot(nodeSnapshot)
        ? []
        : refineSelectedLayerNames(selected, screen.screenName)
    ))
    refinedLayerCount += layerNameRefinements.length
    const previewImageDataUrl = await runScreenPushStage(screen.screenName, "exporting its preview", () => (
      exportNodePreview(selected)
    ))
    const resource = isStoragePush
      ? await runScreenPushStage(screen.screenName, "creating its storage component", () => (
          createEditableStorageResource(
            selected,
            {
              featureName: message.featureName,
              screenName: screen.screenName,
              team: message.team,
            },
            recordId
          )
        ))
      : { componentKey: undefined, nodeId: undefined }

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
      viewCount: 0,
    })
  }

  console.log("[Asphalt Nexus] bulk push saved", newRecords.map((record) => ({
    recordId: record.id,
    screenName: record.screenName,
    sourceNodeId: record.sourceNodeId,
    sourceNodeUrl: record.sourceNodeUrl,
  })))

  const records = await loadRecords()
  await runScreenPushStage("Selected screens", "saving metadata", () => (
    saveRecords([...newRecords, ...records])
  ))
  figma.ui.postMessage({ records: newRecords, type: "records-upserted" } satisfies PluginToUiMessage)
  figma.notify(
    `Refined ${refinedLayerCount} ${refinedLayerCount === 1 ? "layer name" : "layer names"} and saved ${newRecords.length} ${newRecords.length === 1 ? "screen" : "screens"}.`
  )
}

// Adds the screen name and current processing stage to failures from complex Figma nodes.
async function runScreenPushStage<T>(
  screenName: string,
  stage: string,
  task: () => T | Promise<T>
): Promise<T> {
  try {
    return await task()
  } catch (error) {
    throw new Error(`${screenName} failed while ${stage}: ${getPluginErrorMessage(error)}`)
  }
}

// Updates saved metadata and optionally replaces the source with one selected screen.
async function updateStoredScreen(
  message: Extract<PluginMessage, { type: "update-record" }>
) {
  const records = await loadRecords()
  const existing = records.find((record) => record.id === message.recordId)
  if (!existing) {
    throw new Error("Stored screen record was not found.")
  }

  const now = new Date().toISOString()
  const metadataRecord: ScreenRecord = {
    ...existing,
    app: message.app,
    featureName: message.featureName,
    screenName: message.screenName,
    tags: message.tags,
    team: message.team,
    updatedAt: now,
  }

  if (!message.replacement) {
    const savedRecords = await saveRecords(records.map((record) => (
      record.id === message.recordId ? metadataRecord : record
    )))
    const savedRecord = savedRecords.find((record) => record.id === message.recordId) || metadataRecord
    figma.ui.postMessage({ record: savedRecord, type: "record-updated" } satisfies PluginToUiMessage)
    figma.notify(`Updated ${message.screenName}.`)
    return
  }

  const selectedNodes = getSelectedPushableNodes()
  const selected = selectedNodes.length === 1 && selectedNodes[0].id === message.replacement.nodeId
    ? selectedNodes[0]
    : null
  if (!selected) {
    throw new Error("Select exactly one frame, component, or instance to update the source.")
  }

  await loadAllPages()
  removeStorageNode(existing.storageNodeId)

  const isStoragePush = isRunningInStorageFile()
  const sourceNodeMetadata = {
    deviceSize: getNodeSize(selected),
    id: selected.id,
    name: selected.name,
    type: selected.type,
  }
  const nodeSnapshot = serializeNode(selected)
  const informationArchitecture = message.replacement.keepInformationArchitecture
    ? existing.informationArchitecture
    : generateInformationArchitecture(message.screenName, nodeSnapshot, now)
  const layerNameRefinements = isFlattenedPreviewSnapshot(nodeSnapshot)
    ? []
    : refineSelectedLayerNames(selected, message.screenName)
  const previewImageDataUrl = await exportNodePreview(selected)
  const resource = isStoragePush
    ? await createEditableStorageResource(selected, message, message.recordId)
    : { componentKey: undefined, nodeId: undefined }
  const nextRecord: ScreenRecord = {
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
    storagePageName: message.featureName,
  }

  console.log("[Asphalt Nexus] update-record saved", {
    recordId: nextRecord.id,
    screenName: nextRecord.screenName,
    sourceFileKey: nextRecord.sourceFileKey,
    sourceNodeId: nextRecord.sourceNodeId,
    sourceNodeUrl: nextRecord.sourceNodeUrl,
  })

  const savedRecords = await saveRecords(records.map((record) => (
    record.id === message.recordId ? nextRecord : record
  )))
  const savedRecord = savedRecords.find((record) => record.id === message.recordId) || nextRecord
  figma.ui.postMessage({ record: savedRecord, type: "record-updated" } satisfies PluginToUiMessage)
  figma.notify(isStoragePush ? `Updated ${message.screenName}.` : `Updated ${message.screenName} as pending storage.`)
}

// Persists manual IA labels and tree changes on the existing screen record.
async function updateInformationArchitecture(
  message: Extract<PluginMessage, { type: "update-information-architecture" }>
) {
  const records = await loadRecords()
  const existing = records.find((record) => record.id === message.recordId)
  if (!existing) {
    throw new Error("The screen record was not found.")
  }

  const nextRecord: ScreenRecord = {
    ...existing,
    informationArchitecture: message.informationArchitecture,
    updatedAt: new Date().toISOString(),
  }

  await saveRecords(records.map((record) => (
    record.id === message.recordId ? nextRecord : record
  )))
  figma.ui.postMessage({ record: nextRecord, type: "record-upserted" } satisfies PluginToUiMessage)
  figma.ui.postMessage({
    recordId: nextRecord.id,
    type: "information-architecture-saved",
  } satisfies PluginToUiMessage)
  figma.notify("Saved information architecture changes.")
}

// Deletes a stored record and removes its editable component when it exists in this file.
async function deleteStoredScreen(recordId: string) {
  const records = await loadRecords()
  const existing = records.find((record) => record.id === recordId)
  if (!existing) {
    throw new Error("Stored screen record was not found.")
  }

  await loadAllPages()
  removeStorageNode(existing.storageNodeId)
  await saveRecords(records.filter((record) => record.id !== recordId))
  figma.ui.postMessage({ recordId, type: "record-deleted" } satisfies PluginToUiMessage)
  figma.notify(`Deleted ${existing.screenName} from Nexus metadata.`)
}

// Deletes several screen records in one metadata write to avoid concurrent update races.
async function deleteStoredScreens(recordIds: string[]) {
  const targetIds = new Set(recordIds)
  const records = await loadRecords()
  const existingRecords = records.filter((record) => targetIds.has(record.id))

  if (existingRecords.length === 0) {
    throw new Error("The selected screen records were not found.")
  }

  await loadAllPages()
  existingRecords.forEach((record) => removeStorageNode(record.storageNodeId))
  await saveRecords(records.filter((record) => !targetIds.has(record.id)))
  figma.ui.postMessage({
    recordIds: existingRecords.map((record) => record.id),
    type: "records-deleted",
  } satisfies PluginToUiMessage)
  figma.notify(
    `Deleted ${existingRecords.length} ${existingRecords.length === 1 ? "screen" : "screens"} from Nexus metadata.`
  )
}

// Updates local metadata after a successful pull action.
async function incrementPullCount(recordId?: string) {
  if (!recordId) return

  const records = await loadRecords()
  const existing = records.find((record) => record.id === recordId)
  if (!existing) return

  const nextRecord: ScreenRecord = {
    ...existing,
    pullCount: (existing.pullCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  }

  await saveRecords(records.map((record) => (record.id === recordId ? nextRecord : record)))
  figma.ui.postMessage({ record: nextRecord, type: "record-counts-updated" } satisfies PluginToUiMessage)
}

// Persists one detail-screen view without changing the current UI route.
async function incrementViewCount(recordId: string) {
  const records = await loadRecords()
  const existing = records.find((record) => record.id === recordId)
  if (!existing) return

  const nextRecord: ScreenRecord = {
    ...existing,
    viewCount: (existing.viewCount || 0) + 1,
  }

  await saveRecords(records.map((record) => (record.id === recordId ? nextRecord : record)))
  figma.ui.postMessage({ record: nextRecord, type: "record-counts-updated" } satisfies PluginToUiMessage)
}

// Pulls a stored component, creates an instance, then detaches it into editable layers.
async function pullStoredScreen(message: Extract<PluginMessage, { type: "insert-screen" }>) {
  const node = findStorageNode(message.storageNodeId)
  if (isComponentNode(node)) {
    const instance = node.createInstance()
    figma.currentPage.appendChild(instance)
    const detached = instance.detachInstance()
    placePulledNode(detached)
    return detached
  }

  if (message.componentKey && figma.importComponentByKeyAsync) {
    try {
      const component = await figma.importComponentByKeyAsync(message.componentKey)
      const instance = component.createInstance()
      figma.currentPage.appendChild(instance)
      const detached = instance.detachInstance()
      placePulledNode(detached)
      return detached
    } catch {
      figma.notify("Could not import the stored component. Make sure the storage file library is published and accessible.", { error: true })
    }
  }

  throw new Error("This screen is not stored as an editable component yet.")
}

// Creates/reuses feature page and team section, then stores a component copy there.
async function createEditableStorageResource(
  selected: SceneNode,
  message: { featureName: string; screenName: string; team: string },
  recordId: string,
  options: { cloneSource?: boolean } = {}
) {
  await loadAllPages()

  const page = findOrCreatePage(message.featureName)
  const section = findOrCreateSection(page, message.team)
  const clone = options.cloneSource === false ? selected : selected.clone?.()

  if (!clone || !figma.createComponentFromNode) {
    figma.notify("This Figma version cannot create a component from the selected node.", { error: true })
    return { componentKey: undefined, nodeId: undefined }
  }

  const component = figma.createComponentFromNode(clone)
  component.name = `${message.team}/${message.screenName}`
  component.setPluginData?.("nexusRecordId", recordId)
  component.setPluginData?.("nexusTeam", message.team)
  component.setPluginData?.("nexusFeature", message.featureName)
  component.setPluginData?.("nexusScreenName", message.screenName)

  const container = section || page
  container.appendChild(component)
  const itemIndex = Math.max(0, (container.children?.length || 1) - 1)
  component.x = 32 + (itemIndex % 4) * 460
  component.y = 96 + Math.floor(itemIndex / 4) * 960

  return {
    componentKey: component.key,
    nodeId: component.id,
  }
}

// Renames a selected screen and high-confidence generic descendants before IA generation.
function refineSelectedLayerNames(root: SceneNode, screenName: string): LayerNameRefinement[] {
  const refinements: LayerNameRefinement[] = []
  const normalizedScreenName = screenName.replace(/^screen\s*\/\s*/i, "").trim() || "Untitled"
  let visitedNodes = 0

  applyLayerNameRefinement(
    root,
    `Screen / ${normalizedScreenName}`,
    "Selected upload frame",
    1,
    refinements
  )

  // Walks nested layers while limiting work for unusually large design trees.
  const visit = (node: SceneNode, parent: SceneNode, depth: number) => {
    if (depth > 8 || visitedNodes >= 300) return
    visitedNodes += 1

    try {
      if (isGenericFigmaLayerName(node.name)) {
        const suggestion = suggestLayerName(node, parent)
        if (suggestion && suggestion.confidence >= 0.85) {
          applyLayerNameRefinement(
            node,
            suggestion.name,
            suggestion.reason,
            suggestion.confidence,
            refinements
          )
        }
      }

      getSceneNodeChildren(node).forEach((child) => visit(child, node, depth + 1))
    } catch (error) {
      console.warn("[Asphalt Nexus] Skipped an unavailable layer during refinement", error)
    }
  }

  getSceneNodeChildren(root).forEach((child) => visit(child, root, 1))
  return refinements
}

// Produces a semantic name from text, position, and layout signals on a generic layer.
function suggestLayerName(
  node: SceneNode,
  parent: SceneNode
): { confidence: number; name: string; reason: string } | null {
  const text = readSceneNodeText(node) || findFirstSceneNodeText(node)
  const shortText = truncateLayerLabel(text)
  const searchableText = text.toLowerCase()
  const children = getSceneNodeChildren(node)
  const descendantTexts = findSceneNodeTexts(node)
  const actionTexts = descendantTexts.filter(isActionOrNavigationText)
  const actionBranches = children.filter((child) => (
    findSceneNodeTexts(child).some(isActionOrNavigationText)
  )).length
  const textBranches = children.filter((child) => Boolean(findFirstSceneNodeText(child))).length
  const parentHeight = Math.max(parent.height || 0, 1)
  const nearTop = node.y <= parentHeight * 0.18
  const belongsDirectlyToScreen = /^screen\s*\//i.test(parent.name)

  if (node.type === "TEXT" && shortText) {
    return { confidence: 0.98, name: `Text / ${shortText}`, reason: "Visible text content" }
  }

  if (belongsDirectlyToScreen && actionBranches >= 2) {
    return {
      confidence: 0.94,
      name: "Section / Actions",
      reason: "Multiple action-shaped sibling groups",
    }
  }

  if (belongsDirectlyToScreen && isRepeatedSceneNodeCollection(node)) {
    const layoutMode = (node as SnapshotReadableNode).layoutMode
    return {
      confidence: 0.92,
      name: `Content / Content ${layoutMode === "HORIZONTAL" ? "grid" : "list"}`,
      reason: "Repeated sibling structures with similar dimensions",
    }
  }

  if (belongsDirectlyToScreen && actionTexts.length === 0 && textBranches >= 2) {
    const prominentText = truncateLayerLabel(findProminentSceneNodeText(node) || shortText)
    return {
      confidence: 0.9,
      name: `${nearTop ? "Header" : "Content"} / ${prominentText || "Text content"}`,
      reason: "Prominent text hierarchy near the screen root",
    }
  }

  if (actionTexts.length === 1 && children.length > 0 && isLikelyCompactControl(node, parent)) {
    return {
      confidence: 0.93,
      name: `Action / ${truncateLayerLabel(actionTexts[0])}`,
      reason: "Compact container with action-oriented copy",
    }
  }

  if (/search|cari/.test(searchableText)) {
    return { confidence: 0.96, name: "Form / Search", reason: "Search copy and container structure" }
  }

  if (isActionOrNavigationText(text)) {
    return { confidence: 0.94, name: `Action / ${shortText}`, reason: "Action-oriented visible text" }
  }

  if (isLikelySceneNodeBottomNavigation(node, parent, descendantTexts)) {
    return { confidence: 0.92, name: "Navigation / Bottom", reason: "Navigation copy at the bottom of its container" }
  }

  if (nearTop && shortText && children.length > 0) {
    return { confidence: 0.88, name: `Header / ${shortText}`, reason: "Prominent container near the top" }
  }

  if (shortText && children.length > 0) {
    return { confidence: 0.86, name: `Section / ${shortText}`, reason: "Container grouped around visible copy" }
  }

  return null
}

// Collects concise text from a layer subtree for structure-based classification.
function findSceneNodeTexts(node: SceneNode, depth = 0): string[] {
  if (depth > 4) return []

  const ownText = readSceneNodeText(node)
  if (ownText) return [ownText]

  return getSceneNodeChildren(node).flatMap((child) => findSceneNodeTexts(child, depth + 1))
}

// Finds the largest or strongest text in a subtree for contextual section naming.
function findProminentSceneNodeText(node: SceneNode) {
  const candidates = findSceneNodeTextCandidates(node)
    .filter((candidate) => !isActionOrNavigationText(candidate.text))
    .sort((left, right) => right.fontSize - left.fontSize || right.fontWeight - left.fontWeight)
  return candidates[0]?.text || ""
}

// Collects text and typography signals from editable Figma descendants.
function findSceneNodeTextCandidates(
  node: SceneNode,
  depth = 0
): { fontSize: number; fontWeight: number; text: string }[] {
  if (depth > 5) return []

  const source = node as SnapshotReadableNode
  const text = readSceneNodeText(node)
  if (text) {
    return [{
      fontSize: typeof source.fontSize === "number" ? source.fontSize : 0,
      fontWeight: typeof source.fontWeight === "number" ? source.fontWeight : 0,
      text,
    }]
  }

  return getSceneNodeChildren(node).flatMap((child) => (
    findSceneNodeTextCandidates(child, depth + 1)
  ))
}

// Detects common command and navigation copy without depending on layer names.
function isActionOrNavigationText(value: string) {
  return /^(add|apply|back|buy|cancel|close|confirm|continue|delete|done|edit|go|next|open|order|pay|pull|remove|replace|retry|save|search|select|share|skip|submit|upload|view)\b/i.test(value.trim())
}

// Uses relative control dimensions to avoid treating a whole content region as one action.
function isLikelyCompactControl(node: SceneNode, parent: SceneNode) {
  const height = node.height || 0
  const width = node.width || 0
  const parentHeight = Math.max(parent.height || 0, 1)
  const parentWidth = Math.max(parent.width || 0, 1)

  return height >= 24
    && height <= Math.min(112, parentHeight * 0.45)
    && width >= 40
    && width <= parentWidth
}

// Requires a repeated horizontal destination group before renaming a layer as bottom navigation.
function isLikelySceneNodeBottomNavigation(
  node: SceneNode,
  parent: SceneNode,
  descendantTexts: string[]
) {
  const source = node as SnapshotReadableNode
  const parentHeight = Math.max(parent.height || 0, 1)
  const nearBottom = node.y + (node.height || 0) >= parentHeight * 0.82
  const navigationLabels = descendantTexts.filter((value) => (
    /^(activity|chat|explore|home|inbox|menu|orders?|profile|search|settings?)\b/i.test(value)
  ))

  return nearBottom
    && source.layoutMode === "HORIZONTAL"
    && getSceneNodeChildren(node).length >= 3
    && navigationLabels.length >= 2
}

// Detects repeated sibling cards from node type and approximate dimensions.
function isRepeatedSceneNodeCollection(node: SceneNode) {
  const children = getSceneNodeChildren(node).filter((child) => child.type !== "TEXT")
  if (children.length < 3) return false

  const signatures = children.map((child) => (
    `${child.type}:${Math.round((child.width || 0) / 16)}:${Math.round((child.height || 0) / 16)}`
  ))
  const largestRepeatedGroup = signatures.reduce((largest, signature) => (
    Math.max(largest, signatures.filter((candidate) => candidate === signature).length)
  ), 0)

  return largestRepeatedGroup >= 3
}

// Applies one real Figma layer rename and records the reversible before/after metadata.
function applyLayerNameRefinement(
  node: SceneNode,
  refinedName: string,
  reason: string,
  confidence: number,
  refinements: LayerNameRefinement[]
) {
  const originalName = node.name
  if (originalName === refinedName) return

  try {
    node.name = refinedName
    refinements.push({
      confidence,
      nodeId: node.id,
      originalName,
      reason,
      refinedName,
    })
  } catch {
    // Library-controlled instance descendants can reject direct naming changes.
  }
}

// Reads the editable children of a Figma scene node when it is a container.
function getSceneNodeChildren(node: SceneNode) {
  try {
    return ((node as SnapshotReadableNode).children || []) as readonly SceneNode[]
  } catch {
    return []
  }
}

// Reads visible characters directly from a Figma text layer.
function readSceneNodeText(node: SceneNode) {
  try {
    const characters = (node as SnapshotReadableNode).characters
    return typeof characters === "string" ? characters.replace(/\s+/g, " ").trim() : ""
  } catch {
    return ""
  }
}

// Finds the first useful text descendant for naming an otherwise generic container.
function findFirstSceneNodeText(node: SceneNode, depth = 0): string {
  if (depth > 4) return ""

  for (const child of getSceneNodeChildren(node)) {
    const text = readSceneNodeText(child)
    if (text) return text

    const nestedText = findFirstSceneNodeText(child, depth + 1)
    if (nestedText) return nestedText
  }

  return ""
}

// Detects default or numeric Figma layer names that carry little semantic meaning.
function isGenericFigmaLayerName(name: string) {
  return /^(actions|auto\s*layout|block|box|column|component|container|content|content\s*(grid|list)|ellipse|frame|group|instance|item|layer|layers|layout|object|preview\s*actions|rectangle|row|screen\s*details|section|shape|stack|text|vector|wrapper)(\s|#|-|_)*\d*$/i.test(name.trim())
}

// Keeps generated layer labels concise enough for the Figma layers panel.
function truncateLayerLabel(value: string) {
  if (!value) return ""
  return value.length > 44 ? `${value.slice(0, 41).trim()}...` : value
}

// Captures a bounded JSON snapshot so complex screens cannot exhaust plugin memory or storage.
function serializeNode(
  node: SceneNode,
  budget: SnapshotBudget = { complete: true, remaining: maximumSnapshotNodes },
  depth = 0,
  parentId?: string,
  siblingIndex = 0
): NodeSnapshot {
  const source = node as SnapshotReadableNode
  const props: Record<string, SerializableValue> = {}
  budget.remaining -= 1

  for (const prop of snapshotProps) {
    const value = readSerializableSnapshotProp(source, prop)
    if (value !== undefined) {
      props[prop] = value
    }
  }

  const componentIdentity = readComponentIdentity(source)
  if (componentIdentity.id) props.componentId = componentIdentity.id
  if (componentIdentity.name) props.componentName = componentIdentity.name
  if (hasSceneNodeImageFill(source)) props.hasImageFill = true

  const children: NodeSnapshot[] = []
  const sourceChildren = getSceneNodeChildren(node)
  if (depth < maximumSnapshotDepth && budget.remaining > 0) {
    for (let index = 0; index < sourceChildren.length; index += 1) {
      const child = sourceChildren[index]
      if (!shouldCaptureSnapshotNode(child)) continue
      if (budget.remaining <= 0) {
        budget.complete = false
        break
      }
      try {
        children.push(serializeNode(child, budget, depth + 1, node.id, index))
      } catch (error) {
        budget.complete = false
        console.warn("[Asphalt Nexus] Skipped an unavailable layer during snapshot", error)
      }
    }
  } else if (sourceChildren.some(shouldCaptureSnapshotNode)) {
    budget.complete = false
  }

  if (depth === 0) props.snapshotComplete = budget.complete

  return {
    children: children.length > 0 ? children : undefined,
    height: Math.round(node.height || 0),
    id: node.id,
    name: node.name,
    parentId,
    props,
    siblingIndex,
    type: node.type,
    width: Math.round(node.width || 0),
    x: Math.round(node.x || 0),
    y: Math.round(node.y || 0),
  }
}

// Keeps the upload subtree semantic by dropping hidden artwork before it consumes the snapshot budget.
function shouldCaptureSnapshotNode(node: SceneNode) {
  const source = node as SnapshotReadableNode
  const name = node.name.trim()
  const type = node.type

  try {
    if (source.visible === false || source.isMask === true) return false
  } catch {
    return false
  }

  if (["BOOLEAN_OPERATION", "LINE", "POLYGON", "STAR", "VECTOR"].includes(type)) return false
  if (/mask|clip\s*path|background|divider|shadow|decoration|decorative|scrim/i.test(name)) return false

  const hasChildren = getSceneNodeChildren(node).length > 0
  const hasText = Boolean(readSceneNodeText(node))
  const isImage = hasSceneNodeImageFill(source)
  if (!hasChildren && /^(ellipse|rectangle|shape|vector)(?:\s|#|-|_)*\d*$/i.test(name) && !hasText && !isImage) {
    return false
  }
  return true
}

// Reads component identity without serializing the circular main-component node.
function readComponentIdentity(source: SnapshotReadableNode) {
  try {
    const mainComponent = source.mainComponent as { id?: unknown; name?: unknown } | undefined
    return {
      id: typeof mainComponent?.id === "string" ? mainComponent.id : "",
      name: typeof mainComponent?.name === "string" ? mainComponent.name : "",
    }
  } catch {
    return { id: "", name: "" }
  }
}

// Stores only whether image content exists instead of retaining the full paint payload.
function hasSceneNodeImageFill(source: SnapshotReadableNode) {
  try {
    const fills = source.fills
    return Array.isArray(fills) && fills.some((fill) => (
      Boolean(fill) && typeof fill === "object" && "type" in fill && fill.type === "IMAGE"
    ))
  } catch {
    return false
  }
}

// Reads one optional Figma property without allowing host getter failures to abort the push.
function readSerializableSnapshotProp(
  source: SnapshotReadableNode,
  prop: typeof snapshotProps[number]
) {
  try {
    return toSerializable(source[prop])
  } catch {
    return undefined
  }
}

// Rebuilds a saved snapshot as editable Figma nodes in the current file.
async function rebuildNodeSnapshot(snapshot: NodeSnapshot): Promise<SceneNode> {
  const node = createNodeFromSnapshot(snapshot)
  node.name = snapshot.name
  node.x = snapshot.x
  node.y = snapshot.y

  if (node.resize && snapshot.width > 0 && snapshot.height > 0) {
    node.resize(snapshot.width, snapshot.height)
  }

  await applySnapshotProps(node, snapshot)

  const parent = node as SnapshotWritableNode
  if (parent.appendChild && snapshot.children) {
    for (const childSnapshot of snapshot.children) {
      const child = await rebuildNodeSnapshot(childSnapshot)
      parent.appendChild(child)
      child.x = childSnapshot.x
      child.y = childSnapshot.y
    }
  }

  return node
}

// Creates the closest matching Figma node type available in the plugin API.
function createNodeFromSnapshot(snapshot: NodeSnapshot): SceneNode {
  if (snapshot.type === "TEXT") return figma.createText()
  if (snapshot.type === "RECTANGLE") return figma.createRectangle()
  if (snapshot.type === "ELLIPSE" && figma.createEllipse) return figma.createEllipse()
  if (snapshot.type === "LINE" && figma.createLine) return figma.createLine()

  return figma.createFrame()
}

// Applies saved visual/layout properties back onto a rebuilt node when Figma allows them.
async function applySnapshotProps(node: SceneNode, snapshot: NodeSnapshot) {
  const target = node as SnapshotWritableNode
  const fontName = readFontName(snapshot.props.fontName)

  if (snapshot.type === "TEXT") {
    const textFont = fontName || { family: canvasFontFamily, style: "Regular" }
    await figma.loadFontAsync(textFont)
    target.fontName = textFont

    if (typeof snapshot.props.characters === "string") {
      target.characters = snapshot.props.characters
    }
  }

  for (const [prop, value] of Object.entries(snapshot.props)) {
    if (prop === "absoluteBoundingBox" || prop === "characters" || prop === "fontName") continue

    try {
      target[prop] = value
    } catch {
      // Some Figma properties are read-only or unavailable for a specific node type.
    }
  }
}

// Converts JSON-safe font metadata back to the FontName shape.
function readFontName(value: SerializableValue | undefined): FontName | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const family = value.family
  const style = value.style

  if (typeof family !== "string" || typeof style !== "string") return null
  return { family, style }
}

// Deep-clones supported Figma property values into plain JSON for clientStorage.
function toSerializable(value: unknown, seen = new WeakSet<object>()): SerializableValue | undefined {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined

  if (Array.isArray(value)) {
    return value
      .map((item) => toSerializable(item, seen))
      .filter((item): item is SerializableValue => item !== undefined)
  }

  if (typeof value === "object") {
    if (seen.has(value)) return undefined
    seen.add(value)

    const output: Record<string, SerializableValue> = {}
    for (const [key, item] of Object.entries(value)) {
      const serialized = toSerializable(item, seen)
      if (serialized !== undefined) {
        output[key] = serialized
      }
    }

    return output
  }

  return undefined
}

// Checks whether the plugin is running in the configured editable storage file.
function isRunningInStorageFile() {
  return figma.fileKey === storageTarget.fileKey
}

// Loads pages before reading page.children, which newer Figma files require explicitly.
async function loadAllPages() {
  await figma.loadAllPagesAsync?.()
}

// Finds or creates a storage page from user-provided team input.
function findOrCreatePage(teamName: string): PageNode {
  const safeName = sanitizeName(teamName || "Uncategorized")
  const existing = figma.root.children.find((page) => page.name === safeName)
  if (existing) return existing

  const page = figma.createPage()
  page.name = safeName
  return page
}

// Finds or creates a section-like container from user-provided feature input.
function findOrCreateSection(page: PageNode, featureName: string): SectionNode | PageNode {
  const safeName = sanitizeName(featureName || "Uncategorized")
  const existing = page.children.find((node) => node.type === "SECTION" && node.name === safeName)
  if (existing && isSectionNode(existing)) return existing
  if (!figma.createSection) return page

  const section = figma.createSection()
  section.name = safeName
  section.resizeWithoutConstraints?.(1840, 1040)
  page.appendChild(section)
  section.x = 0
  section.y = page.children.length * 1120
  return section
}

// Loads shared metadata from Supabase after clearing the obsolete local simulation once.
async function loadRecords(): Promise<ScreenRecord[]> {
  await clearLegacyLocalRecords()
  const records = await loadDatabaseRecords()
  return records.map(ensureRecordSourceUrl)
}

// Writes the complete shared collection to Supabase.
async function saveRecords(records: ScreenRecord[]) {
  await clearLegacyLocalRecords()
  return saveDatabaseRecords(records)
}

// Removes old clientStorage records once so the database starts as the only source of truth.
async function clearLegacyLocalRecords() {
  const wasCleared = await figma.clientStorage.getAsync(legacyStorageClearedKey)
  if (wasCleared) return
  await figma.clientStorage.setAsync(metadataStorageKey, [])
  await figma.clientStorage.setAsync(legacyStorageClearedKey, true)
}

// Returns the current selected node when it can be exported as a preview.
function getSelectedExportableNode(): SceneNode | null {
  const [selected] = figma.currentPage.selection
  if (!selected) {
    figma.notify("Select a frame or component first.", { error: true })
    return null
  }

  if (!selected.exportAsync) {
    figma.notify("Selected layer cannot be exported. Select a frame or component.", { error: true })
    return null
  }

  return selected
}

// Returns only selected frames, components, and instances that represent pushable screens.
function getSelectedPushableNodes() {
  const supportedTypes = new Set(["FRAME", "COMPONENT", "INSTANCE"])
  return figma.currentPage.selection.filter(
    (node) => supportedTypes.has(node.type) && Boolean(node.exportAsync)
  )
}

// Exports a storage-efficient JPEG preview with enough density for Retina web previews.
async function exportNodePreview(node: SceneNode) {
  const bytes = await node.exportAsync?.({
    constraint: { type: "WIDTH", value: 720 },
    format: "JPG",
  })

  if (!bytes) return ""
  return `data:image/jpeg;base64,${uint8ArrayToBase64(bytes)}`
}

// Formats a node size like 393x852 for metadata display.
function getNodeSize(node: SceneNode) {
  const width = Math.round(node.width || 393)
  const height = Math.round(node.height || 852)
  return `${width}x${height}`
}

// Resolves the most reliable source URL for a selected pushed node.
function createSourceNodeUrl(sourceUrl: string | undefined, nodeId: string) {
  return addNodeIdToFigmaUrl(sourceUrl, nodeId) || createFigmaNodeUrl(nodeId)
}

// Adds the selected node id to a pasted Figma file URL while preserving other query params.
function addNodeIdToFigmaUrl(sourceUrl: string | undefined, nodeId: string) {
  if (!sourceUrl?.trim()) return undefined

  try {
    const url = new URL(sourceUrl.trim())
    url.searchParams.set("node-id", formatUrlNodeId(nodeId))
    return url.toString()
  } catch {
    return sourceUrl.trim()
  }
}

// Backfills older stored records that have file/node ids but no saved source URL.
function ensureRecordSourceUrl(record: ScreenRecord): ScreenRecord {
  if (record.sourceNodeUrl || !record.sourceFileKey || !record.sourceNodeId) return record

  return {
    ...record,
    sourceNodeUrl: createFigmaFileNodeUrl(
      record.sourceFileKey,
      record.sourceFileName || "Figma",
      record.sourceNodeId
    ),
  }
}

// Builds a direct Figma URL for the selected node in the current file.
function createFigmaNodeUrl(nodeId: string) {
  if (figma.fileKey) {
    return createFigmaFileNodeUrl(figma.fileKey, figma.root.name, nodeId)
  }

  return addNodeIdToFigmaUrl(getRememberedCurrentFileUrl(), nodeId)
}

// Saves one confirmed source URL in this Figma document for future selection autofill.
function rememberCurrentFileUrl(sourceUrl: string) {
  try {
    figma.root.setPluginData?.(sourceFileUrlPluginDataKey, sourceUrl)
  } catch {
    // Push still works when plugin data cannot be written in a restricted document.
  }
}

// Reads the current document's previously confirmed source URL.
function getRememberedCurrentFileUrl() {
  try {
    return figma.root.getPluginData?.(sourceFileUrlPluginDataKey) || undefined
  } catch {
    return undefined
  }
}

// Builds a Figma file URL from saved file and node metadata.
function createFigmaFileNodeUrl(fileKey: string, fileName: string, nodeId: string) {
  const urlFileName = encodeURIComponent(sanitizeName(fileName).replace(/\s+/g, "-"))
  return `https://www.figma.com/design/${fileKey}/${urlFileName}?node-id=${formatUrlNodeId(nodeId)}`
}

// Converts Figma node ids from 286:77767 to the URL-safe 286-77767 format.
function formatUrlNodeId(nodeId: string) {
  return encodeURIComponent(nodeId.replace(/:/g, "-"))
}

// Removes an existing stored component if this plugin is running in the same file.
function removeStorageNode(nodeId?: string) {
  const node = findStorageNode(nodeId)
  node?.remove?.()
}

// Finds a stored node by id when it exists in the current Figma file.
function findStorageNode(nodeId?: string) {
  if (!nodeId || !figma.getNodeById) return null
  return figma.getNodeById(nodeId)
}

// Checks whether a stored node can create instances for editable pull.
function isComponentNode(node: BaseNode | null): node is ComponentNode {
  return Boolean(node && node.type === "COMPONENT" && "createInstance" in node)
}

// Places pulled content in the visible viewport and zooms to it.
function placePulledNode(node: SceneNode) {
  node.x = figma.viewport.center.x - Math.round((node.width || 393) / 2)
  node.y = figma.viewport.center.y - Math.round((node.height || 852) / 2)
  figma.viewport.scrollAndZoomIntoView([node])
}

// Creates stable-ish IDs for plugin metadata records.
function createId() {
  return `screen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// Keeps user-generated page/section names readable but not empty.
function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ") || "Uncategorized"
}

// Checks whether a found node has section container behavior.
function isSectionNode(node: SceneNode): node is SectionNode {
  return node.type === "SECTION" && "appendChild" in node
}

// Converts Figma's PNG bytes into a browser-safe base64 string.
function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// Creates a generated mobile screen frame when the user clicks Pull.
async function createScreenFrame(message: Extract<PluginMessage, { type: "insert-screen" }>) {
  await Promise.all([
    figma.loadFontAsync({ family: canvasFontFamily, style: "Regular" }),
    figma.loadFontAsync({ family: canvasFontFamily, style: "Bold" }),
  ])

  const frame = figma.createFrame()
  frame.name = `${message.title} - ${message.platform}`
  frame.resize(393, 852)
  frame.cornerRadius = 32
  frame.clipsContent = true
  frame.fills = [solid("#ffffff")]
  frame.layoutMode = "VERTICAL"
  frame.primaryAxisSizingMode = "FIXED"
  frame.counterAxisSizingMode = "FIXED"
  frame.paddingTop = 56
  frame.paddingRight = 20
  frame.paddingBottom = 24
  frame.paddingLeft = 20
  frame.itemSpacing = 16

  const masthead = figma.createRectangle()
  masthead.name = "Campaign Masthead"
  masthead.resize(353, 132)
  masthead.cornerRadius = 24
  masthead.fills = [solid("#12a216")]
  frame.appendChild(masthead)

  const title = createText(message.title, 24, 30, "Bold", textPaint)
  title.resize(353, 64)
  frame.appendChild(title)

  const meta = createText(`${message.app} / ${message.platform}`, 14, 20, "Regular", mutedPaint)
  meta.resize(353, 24)
  frame.appendChild(meta)

  for (const label of ["Search", "Services", "Wallet", "Recommendations", "Bottom navigation"]) {
    const row = figma.createFrame()
    row.name = label
    row.resize(353, label === "Recommendations" ? 172 : 72)
    row.cornerRadius = 20
    row.fills = [solid("#f2f2f4")]
    row.layoutMode = "VERTICAL"
    row.primaryAxisSizingMode = "FIXED"
    row.counterAxisSizingMode = "FIXED"
    row.paddingTop = 16
    row.paddingRight = 16
    row.paddingBottom = 16
    row.paddingLeft = 16
    row.itemSpacing = 8

    const rowTitle = createText(label, 16, 22, "Bold", label === "Wallet" ? [greenPaint] : textPaint)
    rowTitle.resize(321, 24)
    row.appendChild(rowTitle)
    frame.appendChild(row)
  }

  return frame
}

// Creates a styled Figma text node using the shared Rupa Sans App font settings.
function createText(
  characters: string,
  fontSize: number,
  lineHeight: number,
  style: "Bold" | "Regular",
  fills: Paint[]
) {
  const node = figma.createText()
  node.characters = characters
  node.fontName = { family: canvasFontFamily, style }
  node.fontSize = fontSize
  node.lineHeight = { unit: "PIXELS", value: lineHeight }
  node.fills = fills
  return node
}

// Converts a hex color string into the Paint object format expected by Figma.
function solid(hex: string): Paint {
  const normalized = hex.replace("#", "")
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  return {
    color: { b, g, r },
    type: "SOLID",
  }
}
