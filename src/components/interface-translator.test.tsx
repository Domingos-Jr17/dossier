import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pattern, type Dictionary } from "@/lib/i18n/translate";

import { Translating as InterfaceTranslator } from "./interface-translator";

const dictionary: Dictionary = {
  exact: { "Find jobs": "Procurar vagas", Search: "Pesquisar", "Job title, skill or company": "Cargo, competência ou empresa", Draft: "Rascunho", Sent: "Enviada" },
  patterns: [pattern("{count} postings from {source}", "$1 vagas de $2")],
};

function Screen({ status, found }: { status: string; found: number }) {
  return (
    <main>
      <h1>Find jobs</h1>
      <input aria-label="What" placeholder="Job title, skill or company" defaultValue="Search" />
      <button type="button">Search</button>
      <p>{`${found} postings from emprego.co.mz`}</p>
      <span role="status">{status}</span>
      <article aria-label="Resume">
        <h2>Search</h2>
      </article>
    </main>
  );
}

describe("InterfaceTranslator", () => {
  it("translates the page, and what React renders next", async () => {
    const { rerender } = render(
      <>
        <Screen status="Draft" found={13} />
        <InterfaceTranslator dictionary={dictionary} />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Procurar vagas");
    expect(screen.getByRole("button")).toHaveTextContent("Pesquisar");
    expect(screen.getByText("13 vagas de emprego.co.mz")).toBeInTheDocument();
    expect(screen.getByLabelText("What")).toHaveAttribute("placeholder", "Cargo, competência ou empresa");

    rerender(
      <>
        <Screen status="Sent" found={14} />
        <InterfaceTranslator dictionary={dictionary} />
      </>,
    );
    // The observer runs after the change, as a microtask.
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent("Enviada");
    expect(screen.getByText("14 vagas de emprego.co.mz")).toBeInTheDocument();
  });

  it("keeps what the user wrote as written: fields and documents", () => {
    render(
      <>
        <Screen status="Draft" found={1} />
        <InterfaceTranslator dictionary={dictionary} />
      </>,
    );
    expect(screen.getByLabelText("What")).toHaveValue("Search");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Search");
  });
});
