const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execFilePromise = util.promisify(execFile);

/**
 * Verilog Compiler Service using Yosys for syntax analysis and synthesis.
 */
class VerilogCompiler {
  constructor(workDir) {
    this.workDir = workDir;
    this.yosysPath = process.env.YOSYS_PATH || 'yosys';
  }

  /** Check whether Yosys is installed and reachable. */
  async checkYosys() {
    try {
      const { stdout } = await execFilePromise(this.yosysPath, ['-V']);
      console.log('[VerilogCompiler] Yosys version:', stdout.trim());
      return true;
    } catch {
      console.error('[VerilogCompiler] Yosys not found.');
      return false;
    }
  }

  /**
   * Full synthesis flow with Yosys.
   * @returns {{ success: boolean, output: string, errors: string[], jsonFile: string|null }}
   */
  async synthesize(verilogFile, topModule) {
    const logFile = path.join(this.workDir, 'synthesis.log');
    const jsonFile = path.join(this.workDir, 'synthesis.json');

    const yosysScript = [
      `read_verilog "${verilogFile}"`,
      `hierarchy -check -top ${topModule}`,
      'proc; opt; fsm; opt; memory; opt',
      `synth -top ${topModule}`,
      `write_json "${jsonFile}"`,
    ].join('\n');

    const scriptFile = path.join(this.workDir, 'synth.ys');
    await fs.writeFile(scriptFile, yosysScript);

    try {
      const { stdout, stderr } = await execFilePromise(this.yosysPath, ['-s', scriptFile], {
        cwd: this.workDir,
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      await fs.writeFile(logFile, stdout + stderr);
      const log = await fs.readFile(logFile, 'utf-8');

      if (log.includes('ERROR:') || log.includes('FATAL:')) {
        return { success: false, output: log, errors: this.extractErrors(log), jsonFile: null };
      }
      return { success: true, output: log, errors: [], jsonFile };
    } catch (error) {
      return { success: false, output: error.message, errors: [error.message], jsonFile: null };
    }
  }

  /** Syntax-only check (no optimisation). */
  async checkSyntax(verilogFile) {
    const logFile = path.join(this.workDir, 'syntax.log');
    const scriptFile = path.join(this.workDir, 'check.ys');

    await fs.writeFile(scriptFile, `read_verilog "${verilogFile}"\nhierarchy -check\n`);

    try {
      const { stdout, stderr } = await execFilePromise(this.yosysPath, ['-s', scriptFile], {
        cwd: this.workDir,
        timeout: 10_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      await fs.writeFile(logFile, stdout + stderr);
      const log = await fs.readFile(logFile, 'utf-8');
      return {
        success: !log.includes('ERROR:') && !log.includes('FATAL:'),
        output: log,
        errors: this.extractErrors(log),
      };
    } catch (error) {
      return { success: false, output: error.message, errors: [error.message] };
    }
  }

  /** Extract ERROR / FATAL lines from Yosys log. */
  extractErrors(log) {
    return log
      .split('\n')
      .filter((l) => l.includes('ERROR:') || l.includes('FATAL:'))
      .map((l) => l.trim());
  }
}

module.exports = VerilogCompiler;
