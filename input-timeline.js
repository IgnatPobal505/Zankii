// All timestamps are milliseconds on the same monotonic clock as requestAnimationFrame.
// Queue transitions instead of applying the newest input to time before it happened.
export class FlightTimeline {
  constructor({ maxFrameMs = 150 } = {}) {
    if (!Number.isFinite(maxFrameMs) || maxFrameMs <= 0) throw new RangeError('maxFrameMs must be positive');
    this.maxFrameMs = maxFrameMs;
    this.reset(0);
  }

  // Call on start, resume and interruption. A reset deliberately forgets old touches.
  reset(now, held = false) {
    this.cursor = Number.isFinite(now) ? Math.max(0, now) : 0;
    this.held = Boolean(held);
    this.latestHeld = this.held;
    this.events = [];
    return this;
  }

  setHeld(held, now) {
    held = Boolean(held);
    if (held === this.latestHeld) return false;
    const previous = this.events.at(-1)?.at ?? this.cursor;
    // Delayed or out-of-order browser events cannot rewrite already simulated time.
    const at = Math.max(this.cursor, previous, Number.isFinite(now) ? now : previous);
    this.events.push({ at, held });
    this.latestHeld = held;
    return true;
  }

  // callback(held, seconds) advances the existing fixed-step simulation. Its 240 Hz
  // accumulator remains authoritative; every supplied interval is at most 50 ms.
  // A stall returns before mutating anything. The caller must pause and reset.
  advanceTo(now, callback) {
    const end = Number.isFinite(now) ? Math.max(this.cursor, now) : this.cursor;
    const elapsed = end - this.cursor;
    if (elapsed > this.maxFrameMs + 1e-7) return { stalled: true, advancedSeconds: 0, held: this.held };
    if (typeof callback !== 'function') throw new TypeError('An advance callback is required');
    const advanceInterval = target => {
      while (target - this.cursor > 1e-7) {
        const duration = Math.min(50, target - this.cursor);
        callback(this.held, duration / 1000);
        this.cursor += duration;
      }
      this.cursor = target;
    };
    let count = 0;
    while (count < this.events.length && this.events[count].at <= end) {
      const event = this.events[count++];
      advanceInterval(event.at);
      this.held = event.held;
    }
    if (count) this.events.splice(0, count);
    advanceInterval(end);
    return { stalled: false, advancedSeconds: elapsed / 1000, held: this.held };
  }
}
