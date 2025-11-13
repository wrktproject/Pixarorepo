/**
 * Progressive Renderer
 * Implements progressive rendering for large images to maintain responsiveness
 * Implements task 13: Performance optimization - progressive rendering for large images
 */

export interface ProgressiveRenderConfig {
  enableProgressive?: boolean;
  tileSize?: number;
  maxTilesPerFrame?: number;
  prioritizeViewport?: boolean;
}

export interface RenderTile {
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
}

export interface ProgressiveRenderState {
  totalTiles: number;
  renderedTiles: number;
  progress: number;
  isComplete: boolean;
  currentTile: RenderTile | null;
}

/**
 * ProgressiveRenderer breaks large images into tiles for incremental rendering
 */
export class ProgressiveRenderer {
  private config: Required<ProgressiveRenderConfig>;
  private tiles: RenderTile[] = [];
  private renderedTiles: Set<string> = new Set();
  private currentTileIndex = 0;

  constructor(config: ProgressiveRenderConfig = {}) {
    this.config = {
      enableProgressive: config.enableProgressive ?? true,
      tileSize: config.tileSize ?? 512,
      maxTilesPerFrame: config.maxTilesPerFrame ?? 4,
      prioritizeViewport: config.prioritizeViewport ?? true,
    };
  }

  /**
   * Check if progressive rendering should be used for given dimensions
   */
  public shouldUseProgressive(width: number, height: number): boolean {
    if (!this.config.enableProgressive) {
      return false;
    }

    // Use progressive rendering for images larger than 2048x2048
    const threshold = 2048 * 2048;
    return width * height > threshold;
  }

  /**
   * Initialize tiles for progressive rendering
   */
  public initializeTiles(
    width: number,
    height: number,
    viewportX: number = 0,
    viewportY: number = 0,
    viewportWidth: number = width,
    viewportHeight: number = height
  ): void {
    this.tiles = [];
    this.renderedTiles.clear();
    this.currentTileIndex = 0;

    const tileSize = this.config.tileSize;
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);

    // Generate tiles
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const x = tx * tileSize;
        const y = ty * tileSize;
        const tileWidth = Math.min(tileSize, width - x);
        const tileHeight = Math.min(tileSize, height - y);

        // Calculate priority based on distance from viewport center
        let priority = 0;
        if (this.config.prioritizeViewport) {
          const tileCenterX = x + tileWidth / 2;
          const tileCenterY = y + tileHeight / 2;
          const viewportCenterX = viewportX + viewportWidth / 2;
          const viewportCenterY = viewportY + viewportHeight / 2;

          const dx = tileCenterX - viewportCenterX;
          const dy = tileCenterY - viewportCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Lower distance = higher priority
          priority = -distance;
        } else {
          // Default: render top-to-bottom, left-to-right
          priority = -(ty * tilesX + tx);
        }

        this.tiles.push({
          x,
          y,
          width: tileWidth,
          height: tileHeight,
          priority,
        });
      }
    }

    // Sort tiles by priority (highest first)
    this.tiles.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get next batch of tiles to render
   */
  public getNextTileBatch(): RenderTile[] {
    const batch: RenderTile[] = [];
    const maxTiles = this.config.maxTilesPerFrame;

    while (batch.length < maxTiles && this.currentTileIndex < this.tiles.length) {
      const tile = this.tiles[this.currentTileIndex];
      const tileKey = `${tile.x},${tile.y}`;

      if (!this.renderedTiles.has(tileKey)) {
        batch.push(tile);
        this.renderedTiles.add(tileKey);
      }

      this.currentTileIndex++;
    }

    return batch;
  }

  /**
   * Check if rendering is complete
   */
  public isComplete(): boolean {
    return this.renderedTiles.size === this.tiles.length;
  }

  /**
   * Get current render state
   */
  public getState(): ProgressiveRenderState {
    const currentTile = this.currentTileIndex < this.tiles.length 
      ? this.tiles[this.currentTileIndex] 
      : null;

    return {
      totalTiles: this.tiles.length,
      renderedTiles: this.renderedTiles.size,
      progress: this.tiles.length > 0 ? this.renderedTiles.size / this.tiles.length : 1,
      isComplete: this.isComplete(),
      currentTile,
    };
  }

  /**
   * Reset rendering state
   */
  public reset(): void {
    this.renderedTiles.clear();
    this.currentTileIndex = 0;
  }

  /**
   * Mark a specific tile as rendered
   */
  public markTileRendered(x: number, y: number): void {
    const tileKey = `${x},${y}`;
    this.renderedTiles.add(tileKey);
  }

  /**
   * Check if a tile has been rendered
   */
  public isTileRendered(x: number, y: number): boolean {
    const tileKey = `${x},${y}`;
    return this.renderedTiles.has(tileKey);
  }

  /**
   * Get total number of tiles
   */
  public getTileCount(): number {
    return this.tiles.length;
  }

  /**
   * Get rendered tile count
   */
  public getRenderedTileCount(): number {
    return this.renderedTiles.size;
  }

  /**
   * Get progress percentage (0-100)
   */
  public getProgress(): number {
    return this.tiles.length > 0 
      ? (this.renderedTiles.size / this.tiles.length) * 100 
      : 100;
  }

  /**
   * Estimate remaining render time in milliseconds
   */
  public estimateRemainingTime(avgTileTimeMs: number): number {
    const remainingTiles = this.tiles.length - this.renderedTiles.size;
    return remainingTiles * avgTileTimeMs;
  }

  /**
   * Enable or disable progressive rendering
   */
  public setProgressiveEnabled(enabled: boolean): void {
    this.config.enableProgressive = enabled;
  }

  /**
   * Set tile size
   */
  public setTileSize(size: number): void {
    this.config.tileSize = Math.max(64, Math.min(2048, size));
  }

  /**
   * Set max tiles per frame
   */
  public setMaxTilesPerFrame(count: number): void {
    this.config.maxTilesPerFrame = Math.max(1, Math.min(16, count));
  }
}
