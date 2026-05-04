const fs = require('fs').promises;
const path = require('path');

/**
 * Automatic Testbench Generator for Verilog Modules.
 * Generates testbench from module ports and test cases.
 */
class TestbenchGenerator {
  constructor() {
    this.template = `\`timescale 1ns / 1ps

module {{MODULE_NAME}}_tb;
    // Inputs
{{INPUT_DECLARATIONS}}

    // Outputs
{{OUTPUT_DECLARATIONS}}

    // Instantiate UUT
    {{MODULE_NAME}} uut (
{{PORT_CONNECTIONS}}
    );

    // VCD dump
    initial begin
        $dumpfile("{{VCD_FILENAME}}");
        $dumpvars(0, {{MODULE_NAME}}_tb);
    end

    // Test cases
    initial begin
{{INITIALIZE_INPUTS}}
        #10;
{{TEST_VECTORS}}
        #10;
        $finish;
    end

    // Monitor
    initial begin
        $monitor("Time=%0t {{MONITOR_FORMAT}}", $time{{MONITOR_SIGNALS}});
    end
endmodule
`;
  }

  /** Extract module name, inputs, outputs from Verilog source. */
  extractModuleInfo(verilogCode) {
    const info = { moduleName: null, inputs: [], outputs: [] };

    const moduleMatch = verilogCode.match(/module\s+(\w+)\s*[\(;]/);
    if (moduleMatch) info.moduleName = moduleMatch[1];

    const portSection = verilogCode.match(/module\s+\w+\s*\(([\s\S]*?)\);/);
    if (!portSection) return info;

    const portString = portSection[1];
    const ports = portString.split(',');
    let currentType = null;

    for (const port of ports) {
      const trimmed = port.trim();
      if (!trimmed) continue;

      if (trimmed.includes('input')) currentType = 'input';
      else if (trimmed.includes('output')) currentType = 'output';

      const signalMatch = trimmed.match(/(\w+)\s*$/);
      if (!signalMatch) continue;

      const name = signalMatch[1];
      let width = 1;
      let range = null;
      const rangeMatch = trimmed.match(/\[(\d+):(\d+)\]/);
      if (rangeMatch) {
        const msb = parseInt(rangeMatch[1], 10);
        const lsb = parseInt(rangeMatch[2], 10);
        width = msb - lsb + 1;
        range = `[${msb}:${lsb}]`;
      }

      if (currentType === 'input') info.inputs.push({ name, width, range });
      else if (currentType === 'output') info.outputs.push({ name, width, range });
    }
    return info;
  }

  /** Parse "a=1, b=0" format into { a: '1', b: '0' } */
  parseTestInputs(str) {
    const result = {};
    if (!str) return result;
    for (const pair of str.split(',')) {
      const [k, v] = pair.split('=').map((s) => s.trim());
      if (k && v !== undefined) result[k] = v;
    }
    return result;
  }

  /** Convert a test value to a proper Verilog literal.
   *  Values with >1 digit containing only 0/1/x/z → binary literal. */
  toVerilogLiteral(value, width) {
    const v = value.trim();
    if (v.length > 1 && /^[01xXzZ]+$/.test(v)) {
      return `${v.length}'b${v}`;
    }
    return v;
  }

  /** Same as parseTestInputs but for expected outputs. */
  parseExpectedOutputs(str) {
    return this.parseTestInputs(str);
  }

  /** Generate testbench Verilog code from module source + test cases. */
  generateTestbench(verilogCode, testCases, vcdFilename = 'output.vcd') {
    const info = this.extractModuleInfo(verilogCode);
    if (!info.moduleName) throw new Error('Could not extract module name from Verilog code');

    const inputDecls = info.inputs
      .map((i) => `    reg${i.range ? ' ' + i.range : ''} ${i.name};`)
      .join('\n');
    const outputDecls = info.outputs
      .map((o) => `    wire${o.range ? ' ' + o.range : ''} ${o.name};`)
      .join('\n');
    const portConns = [...info.inputs, ...info.outputs]
      .map((p) => `        .${p.name}(${p.name})`)
      .join(',\n');
    const initInputs = info.inputs
      .map((i) => `        ${i.name} = ${i.width > 1 ? i.width + "'b" + '0'.repeat(i.width) : '0'};`)
      .join('\n');

    const hasClk = info.inputs.some((i) => /clk|clock/i.test(i.name));

    const testVectors = testCases
      .map((tc, idx) => {
        const inputs = this.parseTestInputs(tc.input);
        const outputs = this.parseExpectedOutputs(tc.expected_output || tc.expectedOutput);
        let code = `        // Test ${idx + 1}\n`;

        if (hasClk) {
          const clkName = info.inputs.find((i) => /clk|clock/i.test(i.name)).name;
          const nonClk = Object.entries(inputs).filter(([s]) => !/clk|clock/i.test(s));
          code += nonClk.map(([s, v]) => `        ${s} = ${this.toVerilogLiteral(v)};`).join('\n') + '\n';
          code += `        ${clkName} = 0; #10; ${clkName} = 1; #10; ${clkName} = 0; #10;\n`;
        } else {
          code += Object.entries(inputs).map(([s, v]) => `        ${s} = ${this.toVerilogLiteral(v)};`).join('\n') + '\n';
          code += '        #10;\n';
        }

        code += Object.entries(outputs)
          .map(([s, exp]) => {
            const vExp = this.toVerilogLiteral(exp);
            return `        if (${s} !== ${vExp}) $display("ERROR: Test ${idx + 1} - ${s} = %b, expected ${exp}", ${s});`;
          })
          .join('\n');
        return code;
      })
      .join('\n\n');

    const allSignals = [...info.inputs.map((i) => i.name), ...info.outputs.map((o) => o.name)];
    const monitorFmt = allSignals.map((s) => `${s}=%b`).join(' ');
    const monitorSigs = allSignals.map((s) => `, ${s}`).join('');

    return this.template
      .replace(/{{MODULE_NAME}}/g, info.moduleName)
      .replace('{{INPUT_DECLARATIONS}}', inputDecls)
      .replace('{{OUTPUT_DECLARATIONS}}', outputDecls)
      .replace('{{PORT_CONNECTIONS}}', portConns)
      .replace('{{VCD_FILENAME}}', vcdFilename)
      .replace('{{INITIALIZE_INPUTS}}', initInputs)
      .replace('{{TEST_VECTORS}}', testVectors)
      .replace('{{MONITOR_FORMAT}}', monitorFmt)
      .replace('{{MONITOR_SIGNALS}}', monitorSigs);
  }

  /** Write testbench to disk and return paths. */
  async generateSubmissionTestbench(verilogCode, testCases, workDir) {
    try {
      const tb = this.generateTestbench(verilogCode, testCases, 'output.vcd');
      const info = this.extractModuleInfo(verilogCode);
      const tbPath = path.join(workDir, `${info.moduleName}_tb.v`);
      await fs.writeFile(tbPath, tb);
      return { success: true, testbenchPath: tbPath, moduleName: info.moduleName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = TestbenchGenerator;
