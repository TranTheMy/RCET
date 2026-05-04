const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const { VerilogProblem } = require('../src/models');
const VerilogSimulator = require('../src/services/verilog.simulator');

async function main() {
  const name = 'AND Gate (Custom Testbench)';

  const fixedTestbench = `\`timescale 1ns / 1ps

module and_gate_tb;
    reg a, b;
    wire y;

    and_gate uut (.a(a), .b(b), .y(y));

    initial begin
        $dumpfile("output.vcd");
        $dumpvars(0, and_gate_tb);
    end

    initial begin
        a = 0; b = 0; #10; if (y !== 1'b0) $display("ERROR: 0&0 expected 0, got %b", y);
        a = 0; b = 1; #10; if (y !== 1'b0) $display("ERROR: 0&1 expected 0, got %b", y);
        a = 1; b = 0; #10; if (y !== 1'b0) $display("ERROR: 1&0 expected 0, got %b", y);
        a = 1; b = 1; #10; if (y !== 1'b1) $display("ERROR: 1&1 expected 1, got %b", y);
        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t a=%b b=%b y=%b", $time, a, b, y);
    end
endmodule
`;

  const [updated] = await VerilogProblem.update(
    { testbench: fixedTestbench, testbench_type: 'custom_uploaded' },
    { where: { name } },
  );

  console.log(`[fix_custom_tb] updated rows: ${updated}`);

  // Dry-run compile+sim with a correct student solution
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vkslab_customtb_'));
  const dutPath = path.join(workDir, 'and_gate.v');
  const tbPath = path.join(workDir, 'and_gate_tb.v');

  await fs.writeFile(
    dutPath,
    'module and_gate(input wire a,input wire b,output wire y); assign y=a&b; endmodule\n',
  );
  await fs.writeFile(tbPath, fixedTestbench);

  const sim = new VerilogSimulator(workDir);
  const compileRes = await sim.compile([dutPath], tbPath);
  if (!compileRes.success) {
    console.error('[fix_custom_tb] compile failed:', compileRes.output);
    process.exit(2);
  }

  const runRes = await sim.simulate(compileRes.executableFile, 5000);
  if (!runRes.success) {
    console.error('[fix_custom_tb] simulate failed:', runRes.output);
    process.exit(3);
  }

  if (/^\s*ERROR:/mi.test(runRes.output || '')) {
    console.error('[fix_custom_tb] unexpected ERROR output:', runRes.output);
    process.exit(4);
  }

  console.log('[fix_custom_tb] OK');
}

main().catch((e) => {
  console.error('[fix_custom_tb] fatal:', e);
  process.exit(1);
});

