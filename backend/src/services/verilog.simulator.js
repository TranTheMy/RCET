const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execFilePromise = util.promisify(execFile);

/**
 * Verilog Simulator Service using Icarus Verilog (iverilog + vvp).
 */
class VerilogSimulator {
  constructor(workDir) {
    this.workDir = workDir;
    this.iverilogPath = process.env.IVERILOG_PATH || 'iverilog';
    this.vvpPath = process.env.VVP_PATH || 'vvp';
  }

  /** Check whether iverilog is installed. */
  async checkIverilog() {
    try {
      const { stdout } = await execFilePromise(this.iverilogPath, ['-V']);
      console.log('[VerilogSimulator] Iverilog:', stdout.split('\n')[0]);
      return true;
    } catch {
      console.error('[VerilogSimulator] Iverilog not found.');
      return false;
    }
  }

  /**
   * Compile Verilog source files + testbench into an executable.
   * @returns {{ success, output, errors, executableFile }}
   */
  async compile(verilogFiles, testbenchFile) {
    const outputFile = path.join(this.workDir, 'simulation.out');
    const args = ['-o', outputFile, ...verilogFiles, testbenchFile];

    try {
      const { stdout, stderr } = await execFilePromise(this.iverilogPath, args, {
        cwd: this.workDir,
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = stdout + stderr;

      if (output.toLowerCase().includes('error:') || output.toLowerCase().includes('syntax error')) {
        return {
          success: false,
          output,
          errors: this.extractErrors(output),
          executableFile: null,
        };
      }

      try {
        await fs.access(outputFile);
        return { success: true, output: output || 'Compilation successful', errors: [], executableFile: outputFile };
      } catch {
        return { success: false, output: `Compilation failed: output file not created. ${output}`, errors: [output || 'Output file not created'], executableFile: null };
      }
    } catch (error) {
      return { success: false, output: error.message, errors: [error.message], executableFile: null };
    }
  }

  /**
   * Run the compiled simulation executable (vvp).
   * @returns {{ success, output, vcdFile }}
   */
  async simulate(executableFile, timeLimit = 60_000) {
    try {
      const { stdout, stderr } = await execFilePromise(this.vvpPath, [executableFile], {
        cwd: this.workDir,
        timeout: timeLimit,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = stdout + stderr;

      // Auto-detect any generated VCD file
      const files = await fs.readdir(this.workDir);
      const vcdFiles = files.filter((f) => f.endsWith('.vcd') && !f.includes('expected'));
      const vcdFile = vcdFiles.length > 0 ? path.join(this.workDir, vcdFiles[0]) : null;

      return { success: true, output, vcdFile };
    } catch (error) {
      return { success: false, output: error.message, vcdFile: null };
    }
  }

  /**
   * Compare actual VCD with expected VCD.
   * Returns { match, differences, similarity, totalLines, actualLines, matchedLines }
   */
  async compareVCD(actualVcd, expectedVcd) {
    try {
      const [actualExists, expectedExists] = await Promise.all([
        fs.access(actualVcd).then(() => true).catch(() => false),
        fs.access(expectedVcd).then(() => true).catch(() => false),
      ]);

      if (!actualExists) {
        return { match: false, differences: [{ error: 'Actual VCD file not found' }], similarity: '0.00', totalLines: 0, actualLines: 0, matchedLines: 0 };
      }
      if (!expectedExists) {
        return { match: false, differences: [{ error: 'Expected VCD file not found' }], similarity: '0.00', totalLines: 0, actualLines: 0, matchedLines: 0 };
      }

      const [actualRaw, expectedRaw] = await Promise.all([
        fs.readFile(actualVcd, 'utf-8'),
        fs.readFile(expectedVcd, 'utf-8'),
      ]);

      const filterLines = (raw) =>
        raw
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('$') && !l.startsWith('#0'));

      const actualLines = filterLines(actualRaw);
      const expectedLines = filterLines(expectedRaw);

      if (expectedLines.length === 0) return { match: false, differences: [{ error: 'Expected VCD has no signal data' }], similarity: '0.00', totalLines: 0, actualLines: actualLines.length, matchedLines: 0 };
      if (actualLines.length === 0) return { match: false, differences: [{ error: 'Actual VCD has no signal data' }], similarity: '0.00', totalLines: expectedLines.length, actualLines: 0, matchedLines: 0 };

      let matches = 0;
      const differences = [];
      const maxLines = Math.max(actualLines.length, expectedLines.length);

      for (let i = 0; i < maxLines; i++) {
        const a = actualLines[i] || null;
        const e = expectedLines[i] || null;
        if (a === e) {
          matches++;
        } else {
          differences.push({ line: i + 1, expected: e, actual: a });
        }
      }

      // maxLines already accounts for line-count difference — no separate penalty needed
      const similarity = maxLines === 0 ? 100 : (matches / maxLines) * 100;

      const isPerfectMatch =
        differences.length === 0 &&
        actualLines.length === expectedLines.length &&
        matches === expectedLines.length;

      return {
        match: isPerfectMatch,
        differences: differences.slice(0, 10),
        similarity: similarity.toFixed(2),
        totalLines: expectedLines.length,
        actualLines: actualLines.length,
        matchedLines: matches,
      };
    } catch (error) {
      return { match: false, differences: [{ error: error.message }], similarity: '0.00', totalLines: 0, actualLines: 0, matchedLines: 0 };
    }
  }

  /** Extract error lines from compilation/simulation log. */
  extractErrors(log) {
    return log
      .split('\n')
      .filter((l) => l.includes('error:') || l.includes('syntax error'))
      .map((l) => l.trim());
  }
}

module.exports = VerilogSimulator;
