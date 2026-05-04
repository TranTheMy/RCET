`timescale 1ns / 1ps

module adder_4bit_tb;
    reg [3:0] a, b;
    reg cin;
    wire [3:0] sum;
    wire cout;

    adder_4bit uut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

    initial begin
        $dumpfile("vcd/adder_4bit.vcd");
        $dumpvars(0, adder_4bit_tb);
    end

    initial begin
        // Test 1: 0 + 0 + 0 = 0
        a = 4'b0000; b = 4'b0000; cin = 0;
        #10;
        if (sum !== 4'b0000 || cout !== 1'b0)
            $display("ERROR: Test 1 - sum=%b, cout=%b, expected 0000,0", sum, cout);

        // Test 2: 5 + 3 = 8
        a = 4'b0101; b = 4'b0011; cin = 0;
        #10;
        if (sum !== 4'b1000 || cout !== 1'b0)
            $display("ERROR: Test 2 - sum=%b, cout=%b, expected 1000,0", sum, cout);

        // Test 3: 15 + 1 = 16 (overflow)
        a = 4'b1111; b = 4'b0001; cin = 0;
        #10;
        if (sum !== 4'b0000 || cout !== 1'b1)
            $display("ERROR: Test 3 - sum=%b, cout=%b, expected 0000,1", sum, cout);

        // Test 4: 7 + 8 + 1 = 16
        a = 4'b0111; b = 4'b1000; cin = 1;
        #10;
        if (sum !== 4'b0000 || cout !== 1'b1)
            $display("ERROR: Test 4 - sum=%b, cout=%b, expected 0000,1", sum, cout);

        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t a=%b b=%b cin=%b sum=%b cout=%b", $time, a, b, cin, sum, cout);
    end
endmodule
