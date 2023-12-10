import { spawn } from 'child_process';
import { createInterface, Interface } from 'readline';

class Sudachi {
  // Install with rustup from https://github.com/WorksApplications/sudachi.rs
  process = spawn('sudachi', ['-a']);
  rl: Interface;

  constructor(cb: () => void) {
    this.process.unref();
    this.rl = createInterface({
      input: this.process.stdout,
      terminal: false,
    });
    this.rl.on('line', (ln) => {});
  }

  close() {
    this.process.kill();
  }

  tokenize(s: string) {
    this.process.stdin.write(s);
  }
}
