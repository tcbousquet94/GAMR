// Exit event: call the train at the panel -> countdown (boss spawns, spawns intensify) -> train arrives ->
// step into the boarding zone to finish the stage.

import { EXIT } from '../core/config.js';

export class ExitEvent {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // idle | called | arrived | boarded
    this.t = 0;
    this.countdown = EXIT.countdown;
    this.bossSpawned = false;
    this.data = game.city.exit;
  }

  call() {
    if (this.state !== 'idle') return false;
    const g = this.game;
    this.state = 'called';
    this.t = 0;
    g.events.emit('trainCalled', { countdown: this.countdown });
    return true;
  }

  get remaining() { return Math.max(0, this.countdown - this.t); }

  inBoardZone(p) {
    const B = this.data.board;
    return p.pos.x >= B.x0 && p.pos.x <= B.x1 && p.pos.z >= B.z0 && p.pos.z <= B.z1 && Math.abs(p.pos.y - B.y) < 2;
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'called') {
      this.t += dt;
      if (!this.bossSpawned && this.t >= EXIT.bossDelay) {
        this.bossSpawned = true;
        g.spawnBoss();
      }
      if (this.t >= this.countdown) {
        this.state = 'arrived';
        g.events.emit('trainArrived', {});
      }
    } else if (this.state === 'arrived') {
      if (this.inBoardZone(g.player) && g.player.alive) {
        this.state = 'boarded';
        g.onWin();
      }
    }
  }
}
