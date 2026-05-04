module fsm_traffic_light(
    input  wire       clk,
    input  wire       rst,
    output reg  [1:0] light
);
    localparam [1:0] RED    = 2'b00;
    localparam [1:0] GREEN  = 2'b01;
    localparam [1:0] YELLOW = 2'b10;

    // Simple cycle-based timing to match the provided testbench expectations:
    // RED: 5 cycles, GREEN: 3 cycles, YELLOW: 2 cycles.
    reg [2:0] phase_cnt;

    always @(posedge clk or posedge rst) begin
        if (rst) begin
            light     <= RED;
            phase_cnt <= 3'd0;
        end else begin
            case (light)
                RED: begin
                    if (phase_cnt == 3'd4) begin
                        light     <= GREEN;
                        phase_cnt <= 3'd0;
                    end else begin
                        phase_cnt <= phase_cnt + 3'd1;
                    end
                end
                GREEN: begin
                    if (phase_cnt == 3'd2) begin
                        light     <= YELLOW;
                        phase_cnt <= 3'd0;
                    end else begin
                        phase_cnt <= phase_cnt + 3'd1;
                    end
                end
                YELLOW: begin
                    if (phase_cnt == 3'd1) begin
                        light     <= RED;
                        phase_cnt <= 3'd0;
                    end else begin
                        phase_cnt <= phase_cnt + 3'd1;
                    end
                end
                default: begin
                    light     <= RED;
                    phase_cnt <= 3'd0;
                end
            endcase
        end
    end
endmodule

