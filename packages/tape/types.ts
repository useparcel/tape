import { Reporter } from "./reporter";

export type Asset = {
  content: string | null;
  id?: string;
  ext?: string;
  isEntry?: boolean;
  embedded?: boolean;
  source?: {
    ext: string;
    path: string;
    dir: string;
    name: string;
  };
};

export type AssetContext = {
  asset: Asset;
  report: Reporter;
  addDependency: ({ id, path }) => void;
  resolveAsset: ({ id, path }) => string;
  getAssetContent: ({ id, path }) => string;
};

export type PluginLoader = PluginConstructor | [PluginConstructor, any];
export type PluginConstructor = (config?: any) => Plugin;
export type PluginMethod =
  | "transform"
  | "package"
  | "optimize"
  | "write"
  | "cleanup"
  | "onChange";
export type Plugin = {
  name: string;
  exts?: string[];
  transform?: (
    context: Pick<AssetContext, "asset" | "report" | "addDependency">
  ) => Promise<Asset | Asset[]>;
  package?: (
    context: Pick<
      AssetContext,
      "asset" | "report" | "resolveAsset" | "getAssetContent"
    >
  ) => Promise<Asset>;
  optimize?: (
    context: Pick<
      AssetContext,
      "asset" | "report" | "resolveAsset" | "getAssetContent"
    >
  ) => Promise<Asset>;
  write?: (
    context: Pick<AssetContext, "asset" | "report" | "getAssetContent">
  ) => Promise<string>;
  onChange?: (context: Pick<AssetContext, "asset" | "report">) => Promise<void>;
  cleanup?: (context: Pick<AssetContext, "report">) => Promise<void>;
};

export type FileLoader = (path: string) => Promise<{ content: string }>;

export type Diagnostic = {
  type?: string;
  source?: string;
  path?: string;
  message?: string;
  loc?: null | {
    start: {
      line: number;
      column: number;
    };
    end?: {
      line: number;
      column: number;
    };
  };
};

export type Config = {
  entry: string;
  files: FileLoader | { [file: string]: { content: string } | null };
  plugins?: PluginLoader[];
  signal?: AbortSignal;
};

export type Results = {
  diagnostics: Diagnostic[];
  entry: string;
  files: {
    [path: string]: {
      content: string;
    };
  };
};
