import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category: string;
  disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  disabled?: boolean;
  preventDefault?: boolean;
}

interface KeyboardShortcutGroup {
  category: string;
  shortcuts: KeyboardShortcut[];
}

export function useKeyboardShortcuts({ 
  shortcuts, 
  disabled = false, 
  preventDefault = true 
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isEditable = target.isContentEditable;
    const isInput = ['input', 'textarea', 'select'].includes(tagName);
    
    if (isInput || isEditable) {
      // Allow certain shortcuts even in input fields (like Ctrl+S for save)
      const allowedInInputs = ['s', 'n', 'e', '/', '?'];
      if (!allowedInInputs.includes(event.key.toLowerCase())) {
        return;
      }
      
      // For allowed shortcuts, only trigger if Ctrl/Cmd is pressed
      if (!event.ctrlKey && !event.metaKey && !['/', '?'].includes(event.key)) {
        return;
      }
    }

    const activeShortcuts = shortcutsRef.current.filter(shortcut => !shortcut.disabled);

    for (const shortcut of activeShortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatches = !!shortcut.shift === event.shiftKey;
      const altMatches = !!shortcut.alt === event.altKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        if (preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        try {
          shortcut.action();
        } catch (error) {
          console.error('Error executing keyboard shortcut:', error);
        }
        
        return; // Only execute the first matching shortcut
      }
    }
  }, [disabled, preventDefault]);

  useEffect(() => {
    if (disabled) return;

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, disabled]);

  // Group shortcuts by category for display
  const getShortcutGroups = useCallback((): KeyboardShortcutGroup[] => {
    const groups: { [key: string]: KeyboardShortcut[] } = {};
    
    shortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });

    return Object.entries(groups).map(([category, shortcuts]) => ({
      category,
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
    }));
  }, [shortcuts]);

  // Format shortcut for display
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

  return {
    getShortcutGroups,
    formatShortcut,
    shortcuts: shortcutsRef.current
  };
}

// Common keyboard shortcut patterns
export const createShortcut = (
  key: string,
  action: () => void,
  description: string,
  category: string = 'General',
  options: Partial<Omit<KeyboardShortcut, 'key' | 'action' | 'description' | 'category'>> = {}
): KeyboardShortcut => ({
  key,
  action,
  description,
  category,
  ctrl: true,
  ...options
});

export const createNavigationShortcut = (
  key: string,
  action: () => void,
  description: string
): KeyboardShortcut => createShortcut(key, action, description, 'Navigation');

export const createActionShortcut = (
  key: string,
  action: () => void,
  description: string
): KeyboardShortcut => createShortcut(key, action, description, 'Actions');

export const createViewShortcut = (
  key: string,
  action: () => void,
  description: string
): KeyboardShortcut => createShortcut(key, action, description, 'Views', { ctrl: true });

// Predefined shortcut collections
export const getCommonShortcuts = (actions: {
  save?: () => void;
  new?: () => void;
  export?: () => void;
  help?: () => void;
  toggleSidebar?: () => void;
  search?: () => void;
  undo?: () => void;
  redo?: () => void;
  copy?: () => void;
  paste?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.save) {
    shortcuts.push(createActionShortcut('s', actions.save, 'Save current state'));
  }
  
  if (actions.new) {
    shortcuts.push(createActionShortcut('n', actions.new, 'Create new item'));
  }
  
  if (actions.export) {
    shortcuts.push(createActionShortcut('e', actions.export, 'Export data'));
  }
  
  if (actions.help) {
    shortcuts.push({
      key: '?',
      action: actions.help,
      description: 'Show keyboard shortcuts help',
      category: 'Help',
      ctrl: false
    });
  }
  
  if (actions.toggleSidebar) {
    shortcuts.push(createViewShortcut('\\', actions.toggleSidebar, 'Toggle sidebar'));
  }
  
  if (actions.search) {
    shortcuts.push(createActionShortcut('k', actions.search, 'Open search'));
  }
  
  if (actions.undo) {
    shortcuts.push(createActionShortcut('z', actions.undo, 'Undo last action'));
  }
  
  if (actions.redo) {
    shortcuts.push(createActionShortcut('y', actions.redo, 'Redo last action'));
  }
  
  if (actions.copy) {
    shortcuts.push(createActionShortcut('c', actions.copy, 'Copy selection'));
  }
  
  if (actions.paste) {
    shortcuts.push(createActionShortcut('v', actions.paste, 'Paste from clipboard'));
  }

  return shortcuts;
};

export const getTabNavigationShortcuts = (
  tabs: Array<{ id: string; name: string; action: () => void }>
) => {
  return tabs.map((tab, index) => 
    createNavigationShortcut(
      (index + 1).toString(),
      tab.action,
      `Switch to ${tab.name} tab`
    )
  );
};

// Focus management utilities
export const focusNextElement = () => {
  const focusableElements = document.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
  const nextIndex = (currentIndex + 1) % focusableElements.length;
  (focusableElements[nextIndex] as HTMLElement)?.focus();
};

export const focusPreviousElement = () => {
  const focusableElements = document.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
  const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
  (focusableElements[prevIndex] as HTMLElement)?.focus();
};

export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};