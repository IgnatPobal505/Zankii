// One selected file, independent of the render loop. Times are simulation seconds.
export class MusicPlayer {
  constructor({ audioFactory = () => new Audio(), onStatus = () => {} } = {}) {
    this.audioFactory = audioFactory;
    this.onStatus = onStatus;
    this.audio = null;
    this.source = '';
    this.status = 'missing';
    this.wantsPlay = false;
    this.pendingSeek = null;
    this.playGeneration = 0;
    this.playPending = false;
    this.listeners = [];
  }

  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    try { this.onStatus(status); } catch { /* A status label cannot interrupt the game. */ }
  }

  // Select/load only this file. Nothing starts playing until a user calls resumeAt.
  setSource(src) {
    this.wantsPlay = false; this.pendingSeek = null; this.playPending = false; this.playGeneration++;
    if (this.audio) {
      for (const [name, listener] of this.listeners) this.audio.removeEventListener(name, listener);
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load(); // Abort a previous download or pending play request.
    }
    this.audio = null; this.listeners = []; this.source = typeof src === 'string' ? src : '';
    if (!this.source) { this.setStatus('missing'); return; }
    try {
      const audio = this.audio = this.audioFactory();
      audio.loop = true; audio.volume = .35; audio.preload = 'auto';
      const listen = (name, callback) => {
        const listener = () => { if (this.audio === audio) callback(); };
        audio.addEventListener(name, listener); this.listeners.push([name, listener]);
      };
      listen('loadedmetadata', () => this.applyPendingSeek());
      listen('durationchange', () => this.applyPendingSeek());
      listen('playing', () => {
        if (!this.wantsPlay) { audio.pause(); return; }
        this.applyPendingSeek(); this.setStatus('playing');
      });
      listen('waiting', () => { if (this.wantsPlay) this.setStatus('loading'); });
      listen('pause', () => {
        if (!['error', 'blocked'].includes(this.status) && (!this.wantsPlay || audio.paused)) this.setStatus('paused');
      });
      listen('error', () => {
        this.wantsPlay = false; this.playPending = false; this.pendingSeek = null; this.playGeneration++;
        this.setStatus('error');
      });
      audio.src = this.source; this.setStatus('loading'); audio.load();
    } catch {
      this.wantsPlay = false; this.playPending = false; this.setStatus('error');
    }
  }

  position(seconds) {
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const duration = this.audio?.duration;
    return Number.isFinite(duration) && duration > 0 ? time % duration : time;
  }

  applyPendingSeek() {
    if (!this.audio || this.pendingSeek === null) return;
    try {
      this.audio.currentTime = this.position(this.pendingSeek);
      // Keep the request until metadata exists: assigning before load can be ignored.
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) this.pendingSeek = null;
    } catch { /* loadedmetadata will retry a seek rejected while the file loads. */ }
  }

  // Invoke directly from a user gesture, including when metadata has not loaded.
  resumeAt(seconds) {
    const audio = this.audio;
    if (!audio) { this.setStatus('missing'); return; }
    if (this.wantsPlay && (this.playPending || !audio.paused)) { this.sync(seconds); return; }
    this.wantsPlay = true; this.pendingSeek = seconds; this.applyPendingSeek();
    const generation = ++this.playGeneration; this.playPending = true; this.setStatus('loading');
    try {
      const request = audio.play(); // Keep this synchronous for iPhone gesture activation.
      Promise.resolve(request).then(() => {
        if (this.audio !== audio) { audio.pause(); return; }
        if (generation !== this.playGeneration) { if (!this.wantsPlay) audio.pause(); return; }
        this.playPending = false;
        if (!this.wantsPlay) { audio.pause(); return; }
        this.applyPendingSeek(); this.setStatus('playing');
      }, error => {
        if (this.audio !== audio || generation !== this.playGeneration) return;
        this.wantsPlay = false; this.playPending = false; this.pendingSeek = null;
        this.setStatus(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
      });
    } catch (error) {
      this.wantsPlay = false; this.playPending = false; this.pendingSeek = null;
      this.setStatus(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
  }

  pause() {
    this.wantsPlay = false; this.pendingSeek = null; this.playPending = false; this.playGeneration++;
    if (this.audio) { this.audio.pause(); this.setStatus('paused'); }
    else this.setStatus('missing');
  }

  // Never starts playback. Small clock differences do not cause audible seeking.
  sync(seconds) {
    if (!this.audio || !this.wantsPlay) return;
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      this.pendingSeek = seconds; return;
    }
    const target = this.position(seconds), current = this.position(this.audio.currentTime);
    const difference = Math.abs(target - current);
    const drift = Math.min(difference, this.audio.duration - difference);
    if (this.pendingSeek !== null || drift > .3) { this.pendingSeek = seconds; this.applyPendingSeek(); }
  }
}
