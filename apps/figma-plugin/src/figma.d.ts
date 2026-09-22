declare const __html__: string
declare const __NEXUS_SUPABASE_ANON_KEY__: string
declare const __NEXUS_SUPABASE_URL__: string

declare const figma: {
  clientStorage: {
    getAsync: (key: string) => Promise<unknown>
    setAsync: (key: string, value: unknown) => Promise<void>
  }
  createComponentFromNode?: (node: SceneNode) => ComponentNode
  currentPage: {
    appendChild: (node: SceneNode) => void
    selection: SceneNode[]
  }
  currentUser?: {
    id: string
    name: string
  } | null
  closePlugin: () => void
  createEllipse?: () => EllipseNode
  createFrame: () => FrameNode
  createLine?: () => LineNode
  createPage: () => PageNode
  createRectangle: () => RectangleNode
  createSection?: () => SectionNode
  createText: () => TextNode
  fileKey?: string
  getNodeById?: (id: string) => BaseNode | null
  group: (nodes: SceneNode[], parent: BaseNode) => GroupNode
  importComponentByKeyAsync?: (key: string) => Promise<ComponentNode>
  loadAllPagesAsync?: () => Promise<void>
  loadFontAsync: (fontName: FontName) => Promise<void>
  notify: (message: string, options?: { error?: boolean; timeout?: number }) => void
  on: (event: "selectionchange", callback: () => void) => void
  openExternal: (url: string) => void
  root: {
    children: PageNode[]
    getPluginData?: (key: string) => string
    name: string
    setPluginData?: (key: string, value: string) => void
  }
  showUI: (html: string, options?: { height?: number; themeColors?: boolean; width?: number }) => void
  ui: {
    onmessage: ((message: PluginMessage) => void) | undefined
    postMessage: (message: unknown) => void
    resize: (width: number, height: number) => void
  }
  viewport: {
    center: { x: number; y: number }
    scrollAndZoomIntoView: (nodes: SceneNode[]) => void
  }
}

type PluginMessage =
  | { type: "close" }
  | { type: "delete-record"; recordId: string }
  | { type: "delete-records"; recordIds: string[] }
  | { type: "get-records" }
  | { type: "get-selection" }
  | { type: "insert-screen"; title: string; app: string; platform: string; size: string; componentKey?: string; recordId?: string; storageNodeId?: string }
  | { type: "increment-view"; recordId: string }
  | { type: "notify"; message: string }
  | { type: "open-source-url"; recordId?: string; sourceUrl: string }
  | PushScreensMessage
  | { type: "remove-selection-node"; nodeId: string }
  | { type: "replace-selection"; title: string; app: string; platform: string }
  | { type: "resize"; width: number; height: number }
  | UpdateScreenRecordMessage
  | { type: "update-information-architecture"; recordId: string; informationArchitecture: ScreenInformationArchitecture }

type PluginToUiMessage =
  | { type: "information-architecture-save-failed"; recordId: string }
  | { type: "information-architecture-saved"; recordId: string }
  | { type: "push-screens-failed" }
  | { type: "records-delete-failed"; recordIds: string[] }
  | { type: "record-update-failed"; recordId: string }
  | { type: "record-updated"; record: ScreenRecord }
  | { type: "records-loaded"; records: ScreenRecord[] }
  | { type: "records-load-failed" }
  | { type: "record-deleted"; recordId: string }
  | { type: "records-deleted"; recordIds: string[] }
  | { type: "record-counts-updated"; record: ScreenRecord }
  | { type: "record-upserted"; record: ScreenRecord }
  | { type: "records-upserted"; records: ScreenRecord[] }
  | { type: "selection-changed"; nodes: SelectionNodeSummary[] }

type PushScreensMessage = {
  type: "push-screens"
  app: string
  team: string
  featureName: string
  screens: PushScreenItem[]
}

type PushScreenItem = {
  nodeId: string
  screenName: string
  sourceUrl?: string
  tags?: string[]
}

type UpdateScreenRecordMessage = {
  type: "update-record"
  app: string
  featureName: string
  recordId: string
  screenName: string
  tags: string[]
  team: string
  replacement?: {
    keepInformationArchitecture: boolean
    nodeId: string
    sourceUrl?: string
  }
}

type SelectionNodeSummary = {
  id: string
  name: string
  type: string
  url?: string
}

type ScreenRecord = {
  app: string
  componentKey?: string
  createdAt: string
  createdByName: string
  deviceSize: string
  featureName: string
  id: string
  informationArchitecture?: ScreenInformationArchitecture
  layerNameRefinements?: LayerNameRefinement[]
  previewImageDataUrl: string
  nodeSnapshot?: NodeSnapshot
  pullCount: number
  screenName: string
  sourceFileKey?: string
  sourceFileName?: string
  sourceNodeId: string
  sourceNodeName: string
  sourceNodeType: string
  sourceNodeUrl?: string
  status: "pending_storage" | "stored" | "approved" | "deprecated" | "archived"
  storageFileKey?: string
  storageFileName?: string
  storageFileUrl?: string
  storageNodeId?: string
  storagePageName: string
  storageTargetTeamId: string
  storageTargetTeamUrl: string
  team: string
  tags?: string[]
  updatedAt: string
  viewCount: number
}

type LayerNameRefinement = {
  confidence: number
  nodeId: string
  originalName: string
  reason: string
  refinedName: string
}

type InformationArchitectureRole =
  | "action"
  | "collection"
  | "content"
  | "footer"
  | "form"
  | "header"
  | "label"
  | "media"
  | "navigation"
  | "overlay"
  | "section"
  | "subsection"
  | "text"

type InformationArchitectureNode = {
  children: InformationArchitectureNode[]
  confidence: "high" | "medium" | "low"
  description: string
  exampleValue?: string
  label: string
  persistent: boolean
  priority?: "primary" | "secondary"
  repeatCount?: number
  repeated: boolean
  role: InformationArchitectureRole
  sequence: number
  sourceName: string
  sourceType: string
}

type ScreenInformationArchitecture = {
  analysisMode: "preview-container" | "structure-first" | "unavailable"
  coverageNote: string
  elementCount: number
  freeformText?: string
  generatedAt: string
  purpose: string
  regions: InformationArchitectureNode[]
  screenType: string
  source: "figma-node-tree"
  textCount: number
  version: 10
}

type FontName = {
  family: string
  style: string
}

type BaseNode = {
  appendChild?: (node: SceneNode) => void
  children?: SceneNode[]
  id?: string
  name: string
  remove?: () => void
  setPluginData?: (key: string, value: string) => void
  type?: string
}

type SceneNode = {
  clone?: () => SceneNode
  exportAsync?: (settings?: ExportSettings) => Promise<Uint8Array>
  height?: number
  id: string
  name: string
  parent?: BaseNode
  remove?: () => void
  setPluginData?: (key: string, value: string) => void
  type: string
  width?: number
  x: number
  y: number
  resize?: (width: number, height: number) => void
}

type SerializableValue =
  | boolean
  | null
  | number
  | string
  | SerializableValue[]
  | { [key: string]: SerializableValue }

type NodeSnapshot = {
  children?: NodeSnapshot[]
  height: number
  id?: string
  name: string
  parentId?: string
  props: Record<string, SerializableValue>
  siblingIndex?: number
  type: string
  width: number
  x: number
  y: number
}

type SnapshotReadableNode = SceneNode & {
  [key: string]: unknown
  children?: readonly SceneNode[]
}

type SnapshotWritableNode = SceneNode & {
  [key: string]: unknown
  appendChild?: (node: SceneNode) => void
}

type ExportSettings = {
  constraint?: { type: "WIDTH" | "HEIGHT" | "SCALE"; value: number }
  format: "PNG" | "JPG" | "SVG" | "PDF"
}

type PageNode = BaseNode & {
  appendChild: (node: SceneNode) => void
  children: SceneNode[]
  name: string
  type: "PAGE"
}

type FrameNode = SceneNode & {
  appendChild: (node: SceneNode) => void
  cornerRadius: number
  fills: Paint[]
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL"
  primaryAxisSizingMode: "AUTO" | "FIXED"
  counterAxisSizingMode: "AUTO" | "FIXED"
  itemSpacing: number
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  clipsContent: boolean
  resize: (width: number, height: number) => void
}

type SectionNode = SceneNode & {
  appendChild: (node: SceneNode) => void
  children: SceneNode[]
  resizeWithoutConstraints?: (width: number, height: number) => void
  resize: (width: number, height: number) => void
}

type ComponentNode = FrameNode & {
  createInstance: () => InstanceNode
  key?: string
}

type InstanceNode = FrameNode & {
  detachInstance: () => SceneNode
}

type RectangleNode = SceneNode & {
  cornerRadius: number
  fills: Paint[]
  resize: (width: number, height: number) => void
}

type EllipseNode = RectangleNode

type LineNode = SceneNode & {
  strokes: Paint[]
  strokeWeight: number
  resize: (width: number, height: number) => void
}

type TextNode = SceneNode & {
  characters: string
  fills: Paint[]
  fontName: FontName
  fontSize: number
  fontStyle?: string
  lineHeight: { unit: "PIXELS"; value: number }
  resize: (width: number, height: number) => void
}

type GroupNode = SceneNode

type Paint = {
  color: { b: number; g: number; r: number }
  type: "SOLID"
}
