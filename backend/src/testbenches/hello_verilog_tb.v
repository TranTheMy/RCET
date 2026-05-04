`timescale 1ns / 1ps

module hello_verilog_tb;
    wire y;

    hello_verilog uut (.y(y));

    initial begin
        $dumpfile("vcd/hello_verilog.vcd");
        $dumpvars(0, hello_verilog_tb);
    end

    initial begin
        #10;
        if (y !== 1'b1) $display("ERROR: Test 1 - y = %b, expected 1", y);

        #10;
        if (y !== 1'b1) $display("ERROR: Test 2 - y = %b, expected 1 (stability)", y);

        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t y=%b", $time, y);
    end
endmodule
