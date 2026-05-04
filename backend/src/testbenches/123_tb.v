`timescale 1ns/1ps
module mux2_tb;
  reg a, b, sel;
  wire y;
  mux2 uut (
    .a(a),
    .b(b),
    .sel(sel),
    .y(y)
  );
  // VCD
  initial begin
    $dumpfile("mux2.vcd");
    $dumpvars(0, mux2_tb);
  end
  task check;
    input exp;
    begin
      #1;
      if (y !== exp) begin
        $display("ERROR t=%0t a=%b b=%b sel=%b -> y=%b (expected %b)",
                 $time, a, b, sel, y, exp);
      end
    end
  endtask
  initial begin
    // Test all combinations (8 cases)
    a=0; b=0; sel=0; #5; check(0);
    a=0; b=0; sel=1; #5; check(0);
    a=0; b=1; sel=0; #5; check(0);
    a=0; b=1; sel=1; #5; check(1);
    a=1; b=0; sel=0; #5; check(1);
    a=1; b=0; sel=1; #5; check(0);
    a=1; b=1; sel=0; #5; check(1);
    a=1; b=1; sel=1; #5; check(1);
    $display("Done.");
    $finish;
  end
endmodule