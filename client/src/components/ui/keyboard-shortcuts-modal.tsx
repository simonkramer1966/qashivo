import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Keyboard, 
  Search, 
  X,
  Command,
  Zap,
  MousePointer,
  Eye,
  Settings
} from "lucide-react";
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  title?: string;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
  title = "Keyboard Shortcuts"
}: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Memoized format shortcut function to avoid re-creation
  const formatShortcut = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.ctrl || shortcut.meta) {
      parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    
    let key = shortcut.key;
    // Format special keys
    switch (key.toLowerCase()) {
      case ' ':
        key = 'Space';
        break;
      case 'arrowup':
        key = '↑';
        break;
      case 'arrowdown':
        key = '↓';
        break;
      case 'arrowleft':
        key = '←';
        break;
      case 'arrowright':
        key = '→';
        break;
      case 'escape':
        key = 'Esc';
        break;
      case 'enter':
        key = 'Enter';
        break;
      case 'backspace':
        key = 'Backspace';
        break;
      case 'delete':
        key = 'Delete';
        break;
      case 'tab':
        key = 'Tab';
        break;
      default:
        key = key.toUpperCase();
    }
    
    parts.push(key);
    
    return parts.join(' + ');
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Memoized filtered groups to prevent unnecessary re-calculations
  const filteredGroups = useMemo(() => {
    let filteredShortcuts = shortcuts;
    
    // Filter by search query if exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredShortcuts = shortcuts.filter(shortcut => 
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.category.toLowerCase().includes(query) ||
        formatShortcut(shortcut).toLowerCase().includes(query)
      );
    }

    // Group the shortcuts by category
    const groupedShortcuts: { [key: string]: KeyboardShortcut[] } = {};
    filteredShortcuts.forEach(shortcut => {
      if (!groupedShortcuts[shortcut.category]) {
        groupedShortcuts[shortcut.category] = [];
      }
      groupedShortcuts[shortcut.category].push(shortcut);
    });

    return Object.entries(groupedShortcuts).map(([category, shortcuts]) => ({
      category,
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
    }));
  }, [shortcuts, searchQuery, formatShortcut]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'actions':
        return <Zap className="h-4 w-4" />;
      case 'navigation':
        return <MousePointer className="h-4 w-4" />;
      case 'views':
        return <Eye className="h-4 w-4" />;
      case 'help':
        return <Command className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const highlightSearchTerm = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const totalShortcuts = shortcuts.length;
  const enabledShortcuts = shortcuts.filter(s => !s.disabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card" data-testid="modal-keyboard-shortcuts">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Keyboard className="h-6 w-6 text-[#17B6C3]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold" data-testid="title-shortcuts-modal">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Master these shortcuts to work faster and more efficiently
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs" data-testid="badge-shortcuts-count">
                {enabledShortcuts} active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                data-testid="button-close-shortcuts"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts by name, category, or key combination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
            data-testid="input-search-shortcuts"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              data-testid="button-clear-search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Shortcuts List */}
        <ScrollArea className="h-[500px] pr-4">
          {filteredGroups.length > 0 ? (
            <div className="space-y-6">
              {filteredGroups.map((group, groupIndex) => (
                <div key={group.category} data-testid={`shortcut-group-${group.category.toLowerCase()}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-[#17B6C3]">
                      {getCategoryIcon(group.category)}
                    </div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {group.category}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {group.shortcuts.length}
                    </Badge>
                  </div>
                  
                  <div className="grid gap-3">
                    {group.shortcuts.map((shortcut: KeyboardShortcut, shortcutIndex: number) => (
                      <div
                        key={`${group.category}-${shortcutIndex}`}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          shortcut.disabled 
                            ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60' 
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        data-testid={`shortcut-item-${groupIndex}-${shortcutIndex}`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {highlightSearchTerm(shortcut.description, searchQuery)}
                          </p>
                          {shortcut.disabled && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Currently disabled
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-mono ${
                              shortcut.disabled 
                                ? 'text-gray-400 border-gray-300' 
                                : 'text-[#17B6C3] border-[#17B6C3]/30 bg-[#17B6C3]/5'
                            }`}
                          >
                            {formatShortcut(shortcut)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {groupIndex < filteredGroups.length - 1 && (
                    <Separator className="mt-6" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4 max-w-md mx-auto">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  No shortcuts found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your search terms or clear the search to see all shortcuts
                </p>
              </div>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search-empty"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border">?</kbd> anytime to open this help</span>
            <span>•</span>
            <span>Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border">Esc</kbd> to close</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {totalShortcuts} total shortcuts
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}