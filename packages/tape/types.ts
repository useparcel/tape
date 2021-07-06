export type AssetExtension = `.${string}`;

export type PluginLoader = PluginConstructor | [PluginConstructor, any];
export type PluginConstructor = (config?: any) => Plugin;
export type PluginMethod = 'transform' | 'package' | 'optimize' | 'write' | 'onChange';
export type Plugin = {
  name: string;
  exts?: AssetExtension[];
  transform?: () => void;
  package?: () => void;
  optimize?: () => void;
  write?: () => void;
  onChange?: () => void;
};

export type FileGetter = (path: string) => { content: string };

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
  plugins: PluginLoader[];
  entry: string;
  files: FileGetter | { [file: string]: { content: string } | null };
};
