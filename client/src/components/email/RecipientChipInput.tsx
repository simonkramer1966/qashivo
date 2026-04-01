import { useState, useRef, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus } from "lucide-react";
import ContactPickerPanel from "./ContactPickerPanel";

export interface Suggestion {
  name: string;
  email: string;
  role?: string;
}

interface RecipientChipInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  suggestions?: Suggestion[];
  otherFieldEmails?: string[];
  placeholder?: string;
  label: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecipientChipInput({
  value,
  onChange,
  suggestions = [],
  otherFieldEmails = [],
  placeholder = "Add email…",
  label,
}: RecipientChipInputProps) {
  const [input, setInput] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && EMAIL_RE.test(trimmed) && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      removeEmail(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 min-h-[36px]">
        {value.map((email) => (
          <Badge key={email} variant="secondary" className="gap-1 text-xs font-normal">
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addEmail(input); }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {suggestions.length > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground"
              >
                <Plus className="h-3 w-3 mr-0.5" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <ContactPickerPanel
                suggestions={suggestions}
                selectedEmails={value}
                otherFieldEmails={otherFieldEmails}
                otherFieldLabel={label === "To" ? "CC" : "To"}
                onConfirm={(selected) => {
                  const suggestionEmails = new Set(suggestions.map((s) => s.email.toLowerCase()));
                  const manualEmails = value.filter((e) => !suggestionEmails.has(e));
                  onChange([...manualEmails, ...selected]);
                  setPopoverOpen(false);
                }}
                onCancel={() => setPopoverOpen(false)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
