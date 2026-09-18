export type ScreenStatus = "pending_storage" | "stored" | "approved" | "deprecated" | "archived";

export type SerializableValue =
  | boolean
  | null
  | number
  | string
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type NexusNodeSnapshot = {
  children?: NexusNodeSnapshot[];
  height: number;
  id?: string;
  name: string;
  parentId?: string;
  props: Record<string, SerializableValue>;
  siblingIndex?: number;
  type: string;
  width: number;
  x: number;
  y: number;
};

export type NexusScreenRecord = {
  id: string;
  screenName: string;
  app: string;
  team: string;
  featureName: string;
  status: ScreenStatus;
  deviceSize: string;

  sourceFileKey?: string;
  sourceFileName?: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceNodeType: string;
  sourceNodeUrl?: string;

  storageTargetTeamId: string;
  storageTargetTeamUrl: string;
  storageFileKey?: string;
  storageFileName?: string;
  storageFileUrl?: string;
  storagePageName: string;
  storageNodeId?: string;
  componentKey?: string;

  previewImageDataUrl?: string;
  thumbnailUrl?: string;
  nodeSnapshot?: NexusNodeSnapshot;

  createdByName: string;
  createdAt: string;
  updatedAt: string;

  pullCount: number;
  viewCount: number;

  tags?: string[];
  extractedText?: string;
  iaSummary?: string;
};
