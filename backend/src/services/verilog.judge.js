const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const VerilogCompiler = require('./verilog.compiler');
const VerilogSimulator = require('./verilog.simulator');
const TestbenchGenerator = require('./testbench.generator');
const {
  VerilogSubmission,
  VerilogSubmissionResult,
  VerilogTestCase,
  VerilogProblem,
} = require('../models');
const logger = require('../utils/logger');
const {
  parseSubtestResultsFromSimOutput,
} = require('./verilog.subtest.meta');

/**
 * VKsLab Verilog Judge Service
 *
 * 4-step grading pipeline:
 *   1. Syntax check   (Yosys)
 *   2. Compilation     (Iverilog)
 *   3. Simulation      (VVP)
 *   4. Output compare  (VCD diff / text-based)
 *
 * Supports three testbench modes:
 *   - custom_uploaded   : instructor provides a testbench .v file
 *   - auto_generated    : testbench is built from input/output test-case pairs
 *   - handwritten       : pre-shipped testbenches in /testbenches folder
 *
 * Multi-subtest (custom_uploaded + testcase.subtest_key):
 *   Single simulation; parse lines VKSLAB_SUBTEST id=… status=PASS|FAIL|SKIP
 */
class VerilogJudgeService {
  constructor() {
    this.judgeDir = path.join(__dirname, '../../judge_temp');
    this.testbenchDir = path.join(__dirname, '../testbenches');
    this.queue = [];
    this.processing = false;
    this.toolsAvailable = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  async initialize() {
    await fs.mkdir(this.judgeDir, { recursive: true });
    await fs.mkdir(this.testbenchDir, { recursive: true });

    const compiler = new VerilogCompiler(this.judgeDir);
    const simulator = new VerilogSimulator(this.judgeDir);

    const [yosys, iverilog] = await Promise.all([
      compiler.checkYosys(),
      simulator.checkIverilog(),
    ]);

    this.yosysAvailable = yosys;
    this.toolsAvailable = iverilog; // Iverilog is sufficient; Yosys syntax check is optional
    logger.info(
      this.toolsAvailable
        ? `Verilog judge: Iverilog available${yosys ? ' + Yosys' : ' (Yosys not found – syntax check skipped)'}`
        : 'Verilog judge: tools NOT available – pattern-matching fallback active',
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Judge an entire submission (all test cases for the problem).
   * Called from the controller after a new submission is created.
   */
  async judgeSubmission(submissionId) {
    // Atomic status check to prevent double-judging (race condition)
    const [affectedCount] = await VerilogSubmission.update(
      { status: 'JUDGING' },
      { where: { id: submissionId, status: 'PENDING' } },
    );
    if (affectedCount === 0) {
      logger.warn(`Submission ${submissionId} is not PENDING, skipping judge`);
      return null;
    }

    const submission = await VerilogSubmission.findByPk(submissionId, {
      include: [{ model: VerilogProblem, as: 'problem', include: [{ model: VerilogTestCase, as: 'testcases' }] }],
    });
    if (!submission) throw new Error('Submission not found');

    const problem = submission.problem;
    const rawTcs = problem.testcases || [];
    const testcases = [...rawTcs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    await submission.update({ total_count: testcases.length });

    // Create result rows for each testcase
    const resultRows = await Promise.all(
      testcases.map((tc) =>
        VerilogSubmissionResult.create({
          submission_id: submission.id,
          testcase_id: tc.id,
          status: 'PENDING',
          possible_failure: 'NA',
        }),
      ),
    );

    // Process each test case
    const workDir = path.join(this.judgeDir, `judge_${uuidv4()}`);
    await fs.mkdir(workDir, { recursive: true });

    let totalGrade = 0;
    let maxGrade = 0;
    let passedCount = 0;
    let overallFailure = 'NONE';
    let usedTbSubtestsMode = false;

    try {
      usedTbSubtestsMode = this._problemUsesTbSubtests(problem, testcases);

      if (usedTbSubtestsMode) {
        for (let i = 0; i < testcases.length; i++) {
          maxGrade += testcases[i].grade;
          await resultRows[i].update({ status: 'JUDGING' });
        }
        const gradeResults = await this._gradeCustomTbSubtestsRunOnce(
          submission,
          problem,
          testcases,
          workDir,
        );
        for (let i = 0; i < testcases.length; i++) {
          const gradeResult = gradeResults[i];
          await resultRows[i].update({
            status: 'DONE',
            possible_failure: gradeResult.failure,
            grade: gradeResult.grade,
            log: gradeResult.log,
            app_data: gradeResult.appData || null,
          });
          totalGrade += gradeResult.grade;
          if (gradeResult.failure === 'NONE') passedCount++;
          if (gradeResult.failure !== 'NONE' && overallFailure === 'NONE') {
            overallFailure = gradeResult.failure;
          }
        }
      } else {
        for (let i = 0; i < testcases.length; i++) {
          const tc = testcases[i];
          const result = resultRows[i];
          maxGrade += tc.grade;

          await result.update({ status: 'JUDGING' });

          const tcWorkDir = path.join(workDir, `tc_${i}`);
          await fs.mkdir(tcWorkDir, { recursive: true });

          const gradeResult = await this._gradeTestCase(submission, problem, tc, tcWorkDir);

          await result.update({
            status: 'DONE',
            possible_failure: gradeResult.failure,
            grade: gradeResult.grade,
            log: gradeResult.log,
            app_data: gradeResult.appData || null,
          });

          totalGrade += gradeResult.grade;
          if (gradeResult.failure === 'NONE') passedCount++;
          if (gradeResult.failure !== 'NONE' && overallFailure === 'NONE') {
            overallFailure = gradeResult.failure;
          }
        }
      }
    } catch (err) {
      logger.error('Judge error:', err);
      overallFailure = 'RLE';
      // Mark any remaining PENDING results as ERROR
      await VerilogSubmissionResult.update(
        { status: 'DONE', possible_failure: 'RLE', log: `Judge error: ${err.message}` },
        { where: { submission_id: submissionId, status: ['PENDING', 'JUDGING'] } },
      );
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }

    // Finalise submission
    await submission.update({
      status: 'DONE',
      total_grade: totalGrade,
      max_grade: maxGrade,
      passed_count: passedCount,
      total_count: testcases.length,
      overall_failure: passedCount === testcases.length ? 'NONE' : overallFailure,
      judge_method: usedTbSubtestsMode
        ? (this.toolsAvailable ? 'simulation_subtests' : 'pattern_matching_subtests')
        : (this.toolsAvailable ? 'simulation' : 'pattern_matching'),
    });

    return submission;
  }

  /**
   * All testcases carry subtest_key + problem uses custom_uploaded TB → one sim, split grades.
   */
  _problemUsesTbSubtests(problem, testcases) {
    if (!problem || problem.testbench_type !== 'custom_uploaded' || !String(problem.testbench || '').trim()) {
      return false;
    }
    if (!testcases.length) return false;
    return testcases.every((tc) => tc.subtest_key && String(tc.subtest_key).trim().length > 0);
  }

  /**
   * Run custom TB once; map stdout VKSLAB_SUBTEST lines to each testcase (by subtest_key).
   * @returns {Promise<Array<{ grade: number, failure: string, log: string, appData?: object }>>}
   */
  async _gradeCustomTbSubtestsRunOnce(submission, problem, testcases, workDir) {
    const code = submission.code;
    const tbGen = new TestbenchGenerator();
    const moduleInfo = tbGen.extractModuleInfo(code);

    if (!moduleInfo.moduleName) {
      const log = 'Could not extract module name from submitted code.';
      return testcases.map(() => ({ grade: 0, failure: 'CE', log }));
    }

    const studentFile = path.join(workDir, `${moduleInfo.moduleName}.v`);
    await fs.writeFile(studentFile, code);

    const testbenchContent = problem.testbench;
    if (!testbenchContent) {
      const log = 'No testbench on problem.';
      return testcases.map(() => ({ grade: 0, failure: 'CE', log }));
    }

    if (!this.toolsAvailable) {
      return testcases.map((tc) => this._patternMatch(code, tc));
    }

    const tbFile = path.join(workDir, `${moduleInfo.moduleName}_tb.v`);
    await fs.writeFile(tbFile, testbenchContent);

    const compiler = new VerilogCompiler(workDir);
    const simulator = new VerilogSimulator(workDir);

    if (this.yosysAvailable) {
      const syntaxResult = await compiler.checkSyntax(studentFile);
      if (!syntaxResult.success) {
        const log = `Syntax Error (Yosys):\n${syntaxResult.errors.join('\n')}`;
        return testcases.map(() => ({ grade: 0, failure: 'CE', log }));
      }
    }

    const compileResult = await simulator.compile([studentFile], tbFile);
    if (!compileResult.success) {
      const log = `Compilation Error (Iverilog):\n${compileResult.errors.join('\n')}`;
      return testcases.map(() => ({ grade: 0, failure: 'CE', log }));
    }

    const maxTimeMs = Math.max(...testcases.map((t) => t.time_limit || 60), 1) * 1000;
    const simResult = await simulator.simulate(compileResult.executableFile, maxTimeMs);
    if (!simResult.success) {
      const log = `Runtime Error:\n${simResult.output || ''}`;
      return testcases.map(() => ({ grade: 0, failure: 'RLE', log }));
    }

    const rawOutput = simResult.output || '';
    const statusMap = parseSubtestResultsFromSimOutput(rawOutput);
    const outputLines = rawOutput.split('\n');
    const errorLines = outputLines.filter((l) => /^\s*(ERROR|\*\*Error)/i.test(l));

    return testcases.map((tc) => {
      const key = String(tc.subtest_key).trim();
      const st = statusMap[key];
      const snippet = rawOutput.length > 2500 ? `${rawOutput.slice(0, 2500)}\n…` : rawOutput;

      if (st === 'PASS') {
        return {
          grade: tc.grade,
          failure: 'NONE',
          log: `Subtest "${key}": PASS\n\n${snippet}`,
          appData: { subtest_key: key, status: 'PASS' },
        };
      }
      if (st === 'SKIP') {
        return {
          grade: 0,
          failure: 'WA',
          log: `Subtest "${key}": SKIP\n\n${snippet}`,
          appData: { subtest_key: key, status: 'SKIP' },
        };
      }
      if (st === 'FAIL') {
        return {
          grade: 0,
          failure: 'WA',
          log: `Subtest "${key}": FAIL\n\n${snippet}`,
          appData: { subtest_key: key, status: 'FAIL' },
        };
      }

      const globalErr = errorLines.length
        ? `Lỗi mô phỏng:\n${errorLines.slice(0, 15).join('\n')}`
        : '';
      return {
        grade: 0,
        failure: 'WA',
        log:
          `Không có dòng VKSLAB_SUBTEST cho id=${key} (hoặc sai định dạng).\n` +
          `Đã parse được: ${JSON.stringify(statusMap)}\n${globalErr}\n\n${snippet}`,
        appData: { subtest_key: key, parsed: statusMap },
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Private – grade a single test case                                 */
  /* ------------------------------------------------------------------ */

  async _gradeTestCase(submission, problem, testcase, workDir) {
    const code = submission.code;
    const tbGen = new TestbenchGenerator();
    const moduleInfo = tbGen.extractModuleInfo(code);

    if (!moduleInfo.moduleName) {
      return { grade: 0, failure: 'CE', log: 'Could not extract module name from submitted code.' };
    }

    // Write the student's code to file
    const studentFile = path.join(workDir, `${moduleInfo.moduleName}.v`);
    await fs.writeFile(studentFile, code);

    // Resolve testbench content
    let testbenchContent = null;

    // 1️⃣ Custom uploaded testbench on the problem
    if (problem.testbench_type === 'custom_uploaded' && problem.testbench) {
      testbenchContent = problem.testbench;
    }
    // 2️⃣ Per-testcase testbench code
    else if (testcase.testbench_code) {
      testbenchContent = testcase.testbench_code;
    }
    // 3️⃣ Handwritten testbench shipped with the platform (only for 'handwritten' type)
    else if (problem.testbench_type === 'handwritten') {
      const hwPath = path.join(this.testbenchDir, `${moduleInfo.moduleName}_tb.v`);
      try {
        testbenchContent = await fs.readFile(hwPath, 'utf-8');
      } catch {
        // not found – will auto-generate below
      }
    }

    // 4️⃣ Auto-generate from input/output pairs
    if (!testbenchContent && testcase.input && testcase.expected_output) {
      try {
        testbenchContent = tbGen.generateTestbench(code, [
          { input: testcase.input, expected_output: testcase.expected_output },
        ]);
      } catch (err) {
        return { grade: 0, failure: 'CE', log: `Testbench generation failed: ${err.message}` };
      }
    }

    if (!testbenchContent) {
      return { grade: 0, failure: 'CE', log: 'No testbench available for this test case.' };
    }

    // If tools not available, fall back to pattern matching
    if (!this.toolsAvailable) {
      return this._patternMatch(code, testcase);
    }

    // ========== 4-Step Real Grading ==========

    const tbFile = path.join(workDir, `${moduleInfo.moduleName}_tb.v`);
    await fs.writeFile(tbFile, testbenchContent);

    const compiler = new VerilogCompiler(workDir);
    const simulator = new VerilogSimulator(workDir);

    // Step 1 – Syntax check (Yosys) — optional, skip if not installed
    if (this.yosysAvailable) {
      const syntaxResult = await compiler.checkSyntax(studentFile);
      if (!syntaxResult.success) {
        return {
          grade: 0,
          failure: 'CE',
          log: `Syntax Error (Yosys):\n${syntaxResult.errors.join('\n')}`,
        };
      }
    }

    // Step 2 – Compilation (Iverilog)
    const compileResult = await simulator.compile([studentFile], tbFile);
    if (!compileResult.success) {
      return {
        grade: 0,
        failure: 'CE',
        log: `Compilation Error (Iverilog):\n${compileResult.errors.join('\n')}`,
      };
    }

    // Step 3 – Simulation (VVP)
    const simResult = await simulator.simulate(compileResult.executableFile, testcase.time_limit * 1000);
    if (!simResult.success) {
      return {
        grade: 0,
        failure: 'RLE',
        log: `Runtime Error:\n${simResult.output}`,
      };
    }

    // Step 4 – Output comparison
    return this._evaluateOutput(simResult, testcase, workDir);
  }

  /* ------------------------------------------------------------------ */
  /*  Output evaluation strategies                                       */
  /* ------------------------------------------------------------------ */

  async _evaluateOutput(simResult, testcase, workDir) {
    // Always treat explicit ERROR prints from testbench as Wrong Answer.
    // This protects custom_uploaded testbenches even when testcase has no expected_output/expected_vcd.
    const rawOutput = simResult.output || '';
    const outputLines = rawOutput.split('\n');
    const errorLines = outputLines.filter((l) => /^\s*(ERROR|\*\*Error)/i.test(l));

    // === VCD-based comparison ===
    if (testcase.expected_vcd) {
      if (!simResult.vcdFile) {
        return {
          grade: 0,
          failure: 'RLE',
          log: 'No VCD file generated. Testbench must use $dumpfile / $dumpvars.',
        };
      }

      // Write expected VCD to disk for comparison
      const expectedVcdPath = path.join(workDir, 'expected.vcd');
      await fs.writeFile(expectedVcdPath, testcase.expected_vcd);

      const simulator = new VerilogSimulator(workDir);
      const cmp = await simulator.compareVCD(simResult.vcdFile, expectedVcdPath);
      const sim = parseFloat(cmp.similarity);

      if (cmp.match && sim >= 99.9) {
        return { grade: testcase.grade, failure: 'NONE', log: `Accepted\nSimilarity: ${cmp.similarity}%\nMatched: ${cmp.matchedLines}/${cmp.totalLines} lines` };
      }
      if (sim >= 95) {
        return { grade: Math.floor(testcase.grade * 0.8), failure: 'WA', log: `Near Match\nSimilarity: ${cmp.similarity}%\nDifferences:\n${JSON.stringify(cmp.differences.slice(0, 3), null, 2)}` };
      }
      if (sim >= 70) {
        return { grade: Math.floor(testcase.grade * 0.3), failure: 'WA', log: `Partial Match\nSimilarity: ${cmp.similarity}%` };
      }
      return { grade: 0, failure: 'WA', log: `Wrong Answer\nSimilarity: ${cmp.similarity}%\nDifferences:\n${JSON.stringify(cmp.differences.slice(0, 5), null, 2)}` };
    }

    // === Text-based comparison (simulation output parsing) ===
    if (testcase.expected_output) {
      const hasFinish = outputLines.some((l) => l.includes('$finish'));

      if (errorLines.length === 0 && (hasFinish || rawOutput.length > 0)) {
        // Parse monitor output and compare to expected
        const match = this._compareTextOutput(rawOutput, testcase.expected_output);
        if (match.passed) {
          return { grade: testcase.grade, failure: 'NONE', log: `Accepted\n${match.detail}` };
        }
        return {
          grade: match.partial ? Math.floor(testcase.grade * 0.5) : 0,
          failure: 'WA',
          log: `Wrong Answer\n${match.detail}`,
        };
      }

      return {
        grade: 0,
        failure: 'WA',
        log: `Wrong Answer\nErrors in simulation:\n${errorLines.join('\n')}\n\nFull output:\n${rawOutput.substring(0, 2000)}`,
      };
    }

    // === No expected output – just needs to compile & run ===
    if (errorLines.length > 0) {
      return {
        grade: 0,
        failure: 'WA',
        log: `Wrong Answer\nErrors in simulation:\n${errorLines.slice(0, 20).join('\n')}\n\nFull output:\n${rawOutput.substring(0, 2000)}`,
      };
    }
    return {
      grade: testcase.grade,
      failure: 'NONE',
      log: `Accepted (compile + run)\n\nSimulation output:\n${rawOutput.substring(0, 2000)}`,
    };
  }

  /** Compare simulation monitor output against expected "key=value" pairs.
   *  Checks ALL monitor lines (not just the last one) and returns best match. */
  _compareTextOutput(simOutput, expectedStr) {
    const expected = {};
    for (const pair of expectedStr.split(',')) {
      const [k, v] = pair.split('=').map((s) => s.trim());
      if (k && v !== undefined) expected[k] = v;
    }

    const lines = simOutput.split('\n');
    const monitorLines = lines.filter(
      (l) => l.includes('=') && (l.includes('Time=') || /\b[a-zA-Z_]\w*=/.test(l)),
    );

    if (monitorLines.length === 0) {
      return { passed: false, partial: false, detail: 'No monitor output found' };
    }

    const total = Object.keys(expected).length;
    let bestMatchCount = 0;
    let bestDetails = [];

    // Escape regex special chars in signal names
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const monitorLine of monitorLines) {
      let matchCount = 0;
      const details = [];

      for (const [signal, expVal] of Object.entries(expected)) {
        const re = new RegExp(`\\b${escapeRegex(signal)}\\s*=\\s*([01bxz]+)\\b`, 'i');
        const m = monitorLine.match(re);
        if (m && m[1] === expVal) {
          matchCount++;
          details.push(`${signal}: ${m[1]} (expected ${expVal}) PASS`);
        } else {
          details.push(`${signal}: ${m ? m[1] : 'N/A'} (expected ${expVal}) FAIL`);
        }
      }

      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestDetails = details;
      }
      if (bestMatchCount === total) break; // Perfect match found
    }

    return {
      passed: bestMatchCount === total && total > 0,
      partial: bestMatchCount > 0 && bestMatchCount < total,
      detail: bestDetails.join('\n'),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Pattern matching fallback (no Yosys/Iverilog)                      */
  /* ------------------------------------------------------------------ */

  _patternMatch(code, testcase) {
    // Basic structural checks
    if (!code.includes('module') || !code.includes('endmodule')) {
      return { grade: 0, failure: 'CE', log: 'Missing module/endmodule keywords' };
    }

    const tbGen = new TestbenchGenerator();
    const info = tbGen.extractModuleInfo(code);

    if (!info.moduleName) {
      return { grade: 0, failure: 'CE', log: 'Cannot parse module declaration' };
    }

    // Check that expected signals exist
    if (testcase.expected_output) {
      const expected = {};
      for (const pair of testcase.expected_output.split(',')) {
        const [k] = pair.split('=').map((s) => s.trim());
        if (k) expected[k] = true;
      }

      const allPorts = [...info.inputs.map((i) => i.name), ...info.outputs.map((o) => o.name)];
      const missingSignals = Object.keys(expected).filter((s) => !allPorts.includes(s));

      if (missingSignals.length > 0) {
        return {
          grade: 0,
          failure: 'WA',
          log: `Missing output signals: ${missingSignals.join(', ')}\nDeclared ports: ${allPorts.join(', ')}`,
        };
      }
    }

    // Passed structural check – give partial credit
    return {
      grade: Math.floor(testcase.grade * 0.3),
      failure: 'WA',
      log: 'Structural check passed (pattern matching only – install Yosys & Iverilog for full grading).',
    };
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance() {
    if (!instance) instance = new VerilogJudgeService();
    return instance;
  },
};
