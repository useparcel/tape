import { Config, Results, PluginConstructor } from "./types";
/**
 * Builds the HTML for the given configuration.
 */
export function tape(
  config: Config
): Promise<Results> & {
  /**
   * Runs clean up for the given configuration.
   */
  dispose: (config: Config) => Promise<void>;
};

export type { PluginConstructor as TapePluginConstructor };
