"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchServices, createService, type Service } from "@/lib/services";
import { useSettings } from "@/components/settings-provider";

type ServiceSearchProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectService?: (service: Service) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
};

export function ServiceSearch({
  id = "service",
  value,
  onChange,
  onSelectService,
  placeholder = "Search service or type custom…",
  error,
  disabled,
}: ServiceSearchProps) {
  const { formatCurrency, settings } = useSettings();
  const currency = settings?.default_currency || "INR";

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Custom pricing creation state
  const [customPrice, setCustomPrice] = useState("");
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [customName, setCustomName] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchServices = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchServices(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
  };

  const handleFocus = () => {
    setOpen(true);
    fetchServices(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setOpen(true);
    fetchServices(val);
    setHighlightedIndex(-1);
  };

  const handleSelect = (service: Service) => {
    onChange(service.name);
    onSelectService?.(service);
    setOpen(false);
    setShowCustomCreator(false);
    setHighlightedIndex(-1);
  };

  const handleCreateCustom = async (nameToUse: string, priceToUse: string) => {
    const trimmedName = nameToUse.trim();
    if (!trimmedName) {
      toast.error("Please enter a service name");
      return;
    }
    const parsedPrice = parseFloat(priceToUse) || 0;

    setSavingCustom(true);
    try {
      const created = await createService({
        name: trimmedName,
        price: parsedPrice,
      });
      toast.success(`Created "${trimmedName}" with custom price ${formatCurrency(parsedPrice)}/mo`);
      handleSelect(created);
      setCustomPrice("");
      setCustomName("");
      setShowCustomCreator(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create custom service");
    } finally {
      setSavingCustom(false);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowCustomCreator(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        fetchServices(value);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setShowCustomCreator(false);
    }
  };

  const hasExactMatch = results.some(
    (s) => s.name.toLowerCase() === value.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-invalid={error}
          disabled={disabled}
          autoComplete="off"
          className="pr-8"
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 opacity-60" />
          )}
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* Preset search results */}
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching services…
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No matching services found.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {results.map((service, index) => {
                const isSelected = service.name.toLowerCase() === value.trim().toLowerCase();
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={service.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(service)}
                    className={`flex cursor-pointer items-center justify-between rounded-sm px-2.5 py-2 text-xs transition-colors ${
                      isHighlighted
                        ? "bg-accent text-accent-foreground"
                        : isSelected
                        ? "bg-muted font-medium"
                        : "hover:bg-accent/60"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate font-medium">
                        {service.name}
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary inline shrink-0" />}
                      </div>
                      {service.description && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {service.description}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-semibold tabular-nums text-primary">
                      {formatCurrency(service.price)}
                      <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quick inline custom pricing creation if typed service isn't an exact match */}
          {value.trim() && !hasExactMatch && (
            <div className="mt-1.5 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
              <div className="mb-1.5 flex items-center gap-1 font-medium text-foreground">
                <Tag className="h-3 w-3 text-primary" />
                Add &ldquo;{value.trim()}&rdquo; with custom pricing
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min="0"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={`Monthly price (${currency})`}
                    className="h-7 bg-background text-xs tabular-nums"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCustom(value, customPrice);
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingCustom}
                  onClick={() => handleCreateCustom(value, customPrice)}
                  className="h-7 px-2.5 text-xs shrink-0"
                >
                  {savingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save & Apply"}
                </Button>
              </div>
            </div>
          )}

          {/* Expandable Custom Service Creator */}
          <div className="mt-1 border-t border-border/50 pt-1">
            {!showCustomCreator ? (
              <button
                type="button"
                onClick={() => {
                  setShowCustomCreator(true);
                  if (value.trim() && !hasExactMatch) setCustomName(value.trim());
                }}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-3 w-3 text-primary" />
                Create new service with custom pricing…
              </button>
            ) : (
              <div className="space-y-1.5 rounded-sm bg-muted/40 p-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span>New Custom Service & Pricing</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomCreator(false)}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Cancel
                  </button>
                </div>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Service name…"
                  className="h-7 bg-background text-xs"
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={`Monthly price (${currency})`}
                    className="h-7 bg-background text-xs tabular-nums"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCustom(customName, customPrice);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingCustom || !customName.trim()}
                    onClick={() => handleCreateCustom(customName, customPrice)}
                    className="h-7 px-2.5 text-xs shrink-0"
                  >
                    {savingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save & Select"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
