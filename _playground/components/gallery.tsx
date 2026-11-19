"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  EyeOff,
  Layers3,
  Search,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Prototype } from "@/lib/prototypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
export function Gallery({ items }: { items: Prototype[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [hidden, showHidden] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const available = items.filter((p) => hidden || !p.hidden);
  const tags = Array.from(new Set(available.flatMap((p) => p.tags))).sort();
  const results = available.filter(
    (p) =>
      (!tag || p.tags.includes(tag)) &&
      [p.title, p.description, ...p.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <main className="shell library">
      <div className="eyebrow">
        <span className="signal" />
        WORKSPACE / LIBRARY
      </div>
      <h1>
        Prototype library<span>.</span>
      </h1>
      <p className="intro">
        A personal collection of experiments, simulations, and tools.
      </p>
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <Input
            ref={search}
            aria-label="Search prototypes"
            placeholder="Search prototypes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="tag-select">
              <Tag />
              {tag || "All tags"}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {["", ...tags].map((t) => (
              <DropdownMenuItem onSelect={() => setTag(t)} key={t}>
                {t || "All tags"}
                {tag === t && <Check />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <label className="hidden-toggle">
          <EyeOff size={15} />
          Show hidden
          <Switch checked={hidden} onCheckedChange={showHidden} />
        </label>
      </div>
      <section aria-label="Prototype collection">
        <div className="section-head">
          <h2>
            <Layers3 size={17} />
            All prototypes{" "}
            <span className="count">
              {String(results.length).padStart(2, "0")}
            </span>
          </h2>
          <span>
            <ArrowDownWideNarrow size={14} /> Recently updated
          </span>
        </div>
        {results.map((p) => (
          <PrototypeCard key={p.slug} item={p} />
        ))}
        {!results.length && (
          <div className="empty">
            <h3>No matching prototypes</h3>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setTag("");
                showHidden(true);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
function PrototypeCard({ item: p }: { item: Prototype }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="prototype-card">
      <Link
        className="preview"
        href={"/prototypes/" + p.slug}
        aria-label={"Open " + p.title}
      >
        {p.preview && !failed ? (
          ["light", "dark"].map((theme) => (
            <Image
              key={theme}
              className={
                theme === "dark" ? "hidden dark:block" : "block dark:hidden"
              }
              src={"/thumbnails/" + p.slug + "-" + theme + ".webp"}
              alt={p.title + " preview"}
              width={960}
              height={560}
              onError={() => setFailed(true)}
            />
          ))
        ) : (
          <span>No preview yet</span>
        )}
      </Link>
      <div className="card-info">
        <div className="chips">
          {p.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
          {p.hidden && <span>Hidden</span>}
        </div>
        <h3>{p.title}</h3>
        <p>{p.description}</p>
        <div className="updated">
          <CalendarDays size={14} />
          Updated{" "}
          {new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(p.updatedAt))}
        </div>
        <Button asChild className="open">
          <Link href={"/prototypes/" + p.slug}>
            Open prototype
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}
