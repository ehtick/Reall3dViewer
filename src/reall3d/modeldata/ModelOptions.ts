// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
/**
 * Gaussian Model Options
 */
export interface ModelOptions {
    /**
     * Model URL
     */
    url: string;

    /**
     * Model format (ply | splat | spx | spz | obj), auto-detected by default
     */
    format?: 'ply' | 'splat' | 'spx' | 'spz' | 'obj';

    /**
     * Whether to force re-download
     */
    fetchReload?: boolean;
}
