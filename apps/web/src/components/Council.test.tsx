// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snapshot } from "../test/fixture";
import { Council, WarmthBoard } from "./Council";

afterEach(cleanup);

describe("<Council>", () => {
  it("names proposal types in plain words and shows their status", () => {
    render(<Council snap={snapshot()} />);
    expect(screen.getByText(/New council member/)).toBeTruthy();
    expect(screen.getByText(/Payment from the treasury/)).toBeTruthy();
    expect(screen.getAllByText("Approved")).toHaveLength(2);
  });

  it("shows each member with warmth, or as a founder", () => {
    render(<Council snap={snapshot()} />);
    expect(screen.getByText(/4,000 warmth/)).toBeTruthy();
    expect(screen.getByText(/founder/)).toBeTruthy();
  });
});

describe("<WarmthBoard>", () => {
  it("explains warmth when nobody has any yet", () => {
    render(<WarmthBoard snap={snapshot({ warmth: [] })} />);
    expect(screen.getByText(/earned by pledging in a round that roars/)).toBeTruthy();
  });
});
