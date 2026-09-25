export class ConcurrencyLimiter {
  private readonly maxConcurrency: number;
  private currentActive = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    if (maxConcurrency < 1) {
      throw new Error('maxConcurrency must be at least 1');
    }
    this.maxConcurrency = maxConcurrency;
  }

  get activeCount(): number {
    return this.currentActive;
  }

  get availableSlots(): number {
    return Math.max(0, this.maxConcurrency - this.currentActive);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.currentActive < this.maxConcurrency) {
      this.currentActive++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    this.currentActive--;
    if (this.waiting.length > 0 && this.currentActive < this.maxConcurrency) {
      this.currentActive++;
      const next = this.waiting.shift()!;
      next();
    }
  }
}
