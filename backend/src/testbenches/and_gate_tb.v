`timescale 1ns / 1ps

module and_gate_tb;
    reg a, b;
    wire y;

    and_gate uut (.a(a), .b(b), .y(y));

    initial begin
        $dumpfile("vcd/and_gate.vcd");
        $dumpvars(0, and_gate_tb);
    end

    initial begin
        // Test 1: 0 AND 0 = 0
        a = 0; b = 0;
        #10;
        if (y !== 1'b0) $display("ERROR: Test 1 - y = %b, expected 0", y);

        // Test 2: 0 AND 1 = 0
        a = 0; b = 1;
        #10;
        if (y !== 1'b0) $display("ERROR: Test 2 - y = %b, expected 0", y);

        // Test 3: 1 AND 0 = 0
        a = 1; b = 0;
        #10;
        if (y !== 1'b0) $display("ERROR: Test 3 - y = %b, expected 0", y);

        // Test 4: 1 AND 1 = 1
        a = 1; b = 1;
        #10;
        if (y !== 1'b1) $display("ERROR: Test 4 - y = %b, expected 1", y);

        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t a=%b b=%b y=%b", $time, a, b, y);
    end
endmodule
