`timescale 1ns / 1ps

module fsm_traffic_light_tb;
    reg clk, rst;
    wire [1:0] light;
    // light: 2'b00=RED, 2'b01=GREEN, 2'b10=YELLOW

    fsm_traffic_light uut (.clk(clk), .rst(rst), .light(light));

    // Clock: 10ns period
    initial clk = 0;
    always #5 clk = ~clk;

    initial begin
        $dumpfile("vcd/fsm_traffic_light.vcd");
        $dumpvars(0, fsm_traffic_light_tb);
    end

    initial begin
        // Reset - should go to RED
        rst = 1;
        #12;
        if (light !== 2'b00)
            $display("ERROR: After reset, light should be RED (00), got %b", light);

        // Release reset, observe state transitions
        rst = 0;

        // Stay in RED for a few cycles, then expect GREEN
        #50;
        if (light !== 2'b01)
            $display("NOTE: Expected GREEN (01) after RED period, got %b", light);

        // Expect YELLOW after GREEN
        #30;
        if (light !== 2'b10)
            $display("NOTE: Expected YELLOW (10) after GREEN period, got %b", light);

        // Expect RED again after YELLOW
        #20;
        if (light !== 2'b00)
            $display("NOTE: Expected RED (00) after YELLOW period, got %b", light);

        // Test reset mid-cycle
        #15;
        rst = 1;
        #10;
        if (light !== 2'b00)
            $display("ERROR: After mid-cycle reset, light should be RED (00), got %b", light);

        rst = 0;
        #100;

        $finish;
    end

    initial begin
        $monitor("Time=%0t clk=%b rst=%b light=%b", $time, clk, rst, light);
    end
endmodule
