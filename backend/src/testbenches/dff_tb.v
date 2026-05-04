`timescale 1ns / 1ps

module dff_tb;
    reg clk, rst, d;
    wire q, q_bar;

    dff uut (.clk(clk), .rst(rst), .d(d), .q(q), .q_bar(q_bar));

    // Clock: 10ns period
    initial clk = 0;
    always #5 clk = ~clk;

    initial begin
        $dumpfile("vcd/dff.vcd");
        $dumpvars(0, dff_tb);
    end

    initial begin
        // Reset
        rst = 1; d = 0;
        #12;
        if (q !== 1'b0)
            $display("ERROR: After reset q should be 0, got %b", q);

        // Release reset, set d=1
        rst = 0; d = 1;
        #10;
        if (q !== 1'b1)
            $display("ERROR: After d=1 rising edge, q should be 1, got %b", q);

        // d=0 next cycle
        d = 0;
        #10;
        if (q !== 1'b0)
            $display("ERROR: After d=0 rising edge, q should be 0, got %b", q);

        // d=1 then reset during high
        d = 1;
        #10;
        rst = 1;
        #10;
        if (q !== 1'b0)
            $display("ERROR: After reset, q should be 0, got %b", q);

        // Release reset, d still 1
        rst = 0;
        #10;
        if (q !== 1'b1)
            $display("ERROR: After reset release with d=1, q should be 1, got %b", q);

        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t clk=%b rst=%b d=%b q=%b q_bar=%b", $time, clk, rst, d, q, q_bar);
    end
endmodule
