// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snapshot } from "../test/fixture";
import { Rules } from "./Rules";

afterEach(cleanup);

describe("<Rules>", () => {
  it("prints the launch parameters read from the chain", () => {
    render(<Rules snap={snapshot()} />);
    expect(screen.getByText("10 minutes")).toBeTruthy();
    expect(screen.getByText("150%")).toBeTruthy();
    expect(screen.getByText("1,000 EMBER")).toBeTruthy();
  });

  it("draws the line schedule up to 3× the base", () => {
    render(<Rules snap={snapshot()} />);
    expect(screen.getByText("streak 20")).toBeTruthy();
    expect(screen.getAllByText("3,000").length).toBeGreaterThan(0);
  });
});
