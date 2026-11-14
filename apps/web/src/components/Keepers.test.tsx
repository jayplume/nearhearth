// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { snapshot } from "../test/fixture";
import { Keepers } from "./Keepers";

afterEach(cleanup);

describe("<Keepers>", () => {
  it("shows each keeper's strategy and its live reason", () => {
    render(<Keepers snap={snapshot()} />);
    expect(screen.getByText("keeper-01")).toBeTruthy();
    expect(screen.getByText("Pledged 100 this round")).toBeTruthy();
    // The free rider explains itself, from the same strategy file the agent runs.
    expect(screen.getByText(/Sparks only go to pledgers/)).toBeTruthy();
  });

  it("filters the roster by strategy", () => {
    render(<Keepers snap={snapshot()} />);
    fireEvent.click(screen.getByRole("button", { name: /Closer/ }));
    expect(screen.queryByText("keeper-01")).toBeNull();
    expect(screen.getByText("keeper-08")).toBeTruthy();
  });
});
