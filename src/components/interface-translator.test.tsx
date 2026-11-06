import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pattern, type Dictionary } from "@/lib/i18n/translate";

import { Translating, whenHydrated } from "./interface-translator";

/** The translator as soon as it mounts, without waiting for hydration (whenHydrated has its own tests). */
const InterfaceTranslator = ({ dictionary }: { dictionary: Dictionary }) => <Translating dictionary={dictionary} immediate />;

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

  it("translates the buttons of a document's sections, which sit inside what the AI wrote", () => {
    render(
      <>
        <article aria-label="Resume">
          <p>Search</p>
          <button type="button" aria-label="Find jobs">
            Search
          </button>
        </article>
        <InterfaceTranslator dictionary={dictionary} />
      </>,
    );
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Pesquisar");
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Procurar vagas");
  });
});

describe("whenHydrated", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("runs once the page is loaded and no boundary waits for streamed content, not before", async () => {
    vi.useFakeTimers();
    // React marks a Suspense boundary that is still waiting for its content with <!--$?-->.
    document.body.append(document.createComment("$?"));
    const run = vi.fn();
    whenHydrated(run);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();

    document.body.innerHTML = "";
    document.body.append(document.createComment("$"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives up waiting after the limit, and stops when cancelled", async () => {
    vi.useFakeTimers();
    document.body.append(document.createComment("$?"));
    const late = vi.fn();
    whenHydrated(late, 2000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(late).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    const cancel = whenHydrated(cancelled, 2000);
    cancel();
    await vi.advanceTimersByTimeAsync(3000);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
