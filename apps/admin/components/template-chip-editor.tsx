'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  formatTemplateVariable,
  normalizeTemplateVariableName,
  tokenizeTemplateBody
} from '@/lib/template-variables';

interface TemplateChipEditorProps {
  value: string;
  variables: string[];
  onChange: (nextValue: string) => void;
  onAddVariable: (name: string) => void;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  if (node.dataset.variableToken) {
    return formatTemplateVariable(node.dataset.variableToken);
  }

  if (node.tagName === 'BR') {
    return '\n';
  }

  return Array.from(node.childNodes).map(serializeNode).join('');
}

function serializeEditor(root: HTMLElement): string {
  return Array.from(root.childNodes).map(serializeNode).join('');
}

function nodePlainLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0;
  }

  if (!(node instanceof HTMLElement)) {
    return 0;
  }

  if (node.dataset.variableToken) {
    return formatTemplateVariable(node.dataset.variableToken).length;
  }

  if (node.tagName === 'BR') {
    return 1;
  }

  return Array.from(node.childNodes).reduce((sum, child) => sum + nodePlainLength(child), 0);
}

function getPlainTextOffset(root: Node, targetNode: Node, targetOffset: number): number {
  let total = 0;
  let found = false;

  function walk(node: Node) {
    if (found) {
      return;
    }

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        total += targetOffset;
      } else if (node instanceof HTMLElement && node.dataset.variableToken) {
        total += targetOffset > 0 ? formatTemplateVariable(node.dataset.variableToken).length : 0;
      } else {
        for (let index = 0; index < targetOffset; index += 1) {
          const child = node.childNodes[index];
          if (child) {
            total += nodePlainLength(child);
          }
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      total += node.textContent?.length ?? 0;
      return;
    }

    if (node instanceof HTMLElement && node.dataset.variableToken) {
      total += formatTemplateVariable(node.dataset.variableToken).length;
      return;
    }

    if (node instanceof HTMLElement && node.tagName === 'BR') {
      total += 1;
      return;
    }

    Array.from(node.childNodes).forEach((child) => walk(child));
  }

  walk(root);
  return total;
}

function resolvePoint(root: HTMLElement, offset: number): { node: Node; offset: number } {
  let remaining = offset;

  function walk(node: Node): { node: Node; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        return { node, offset: remaining };
      }
      remaining -= length;
      return null;
    }

    if (!(node instanceof HTMLElement)) {
      return null;
    }

    if (node.dataset.variableToken) {
      const tokenLength = formatTemplateVariable(node.dataset.variableToken).length;
      const parent = node.parentNode ?? root;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);

      if (remaining <= 0) {
        return { node: parent, offset: index };
      }

      if (remaining < tokenLength) {
        return { node: parent, offset: index + 1 };
      }

      remaining -= tokenLength;
      return null;
    }

    if (node.tagName === 'BR') {
      const parent = node.parentNode ?? root;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      if (remaining <= 1) {
        return { node: parent, offset: index + 1 };
      }
      remaining -= 1;
      return null;
    }

    for (const child of Array.from(node.childNodes)) {
      const point = walk(child);
      if (point) {
        return point;
      }
    }

    return null;
  }

  return walk(root) ?? { node: root, offset: root.childNodes.length };
}

export function TemplateChipEditor({
  value,
  variables,
  onChange,
  onAddVariable
}: TemplateChipEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const lastValueRef = useRef(value);
  const [newVariable, setNewVariable] = useState('');

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextSerialized = value;
    const currentSerialized = serializeEditor(editor);
    if (currentSerialized === nextSerialized) {
      return;
    }

    editor.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const token of tokenizeTemplateBody(value)) {
      if (token.type === 'text') {
        fragment.appendChild(document.createTextNode(token.value));
        continue;
      }

      const chip = document.createElement('span');
      chip.dataset.variableToken = token.value;
      chip.contentEditable = 'false';
      chip.className =
        'mx-0.5 inline-flex select-none items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 align-baseline text-xs font-semibold text-primary';

      const badge = document.createElement('span');
      badge.className =
        'rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground';
      badge.textContent = '변수';

      const label = document.createElement('span');
      label.textContent = token.value;

      chip.appendChild(badge);
      chip.appendChild(label);
      fragment.appendChild(chip);
    }

    editor.appendChild(fragment);

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const startPoint = resolvePoint(editor, selectionRef.current.start);
    const endPoint = resolvePoint(editor, selectionRef.current.end);
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [value]);

  function syncSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      return;
    }

    selectionRef.current = {
      start: getPlainTextOffset(editor, range.startContainer, range.startOffset),
      end: getPlainTextOffset(editor, range.endContainer, range.endOffset)
    };
  }

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    syncSelection();
    const nextValue = serializeEditor(editor);
    if (nextValue !== lastValueRef.current) {
      onChange(nextValue);
    }
  }

  function insertAtSelection(text: string) {
    const nextStart = Math.min(selectionRef.current.start, selectionRef.current.end);
    const nextEnd = Math.max(selectionRef.current.start, selectionRef.current.end);
    const nextValue = `${value.slice(0, nextStart)}${text}${value.slice(nextEnd)}`;
    const caret = nextStart + text.length;

    selectionRef.current = { start: caret, end: caret };
    onChange(nextValue);

    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }

  function handleVariableInsert(variable: string) {
    insertAtSelection(formatTemplateVariable(variable));
  }

  function handleAddVariable() {
    const normalized = normalizeTemplateVariableName(newVariable);
    if (!normalized) {
      return;
    }

    onAddVariable(normalized);
    setNewVariable('');
    handleVariableInsert(normalized);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>변수 칩</Label>
          <span className="text-xs text-muted-foreground">칩을 누르면 본문에 `#&#123;변수&#125;`가 삽입됩니다.</span>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border bg-background/80 p-3">
          {variables.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => handleVariableInsert(variable)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition hover:border-primary/30 hover:bg-primary/10"
            >
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                변수
              </span>
              <span>{variable}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
        <Input
          placeholder="새 변수 이름 추가"
          value={newVariable}
          onChange={(event) => setNewVariable(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddVariable();
            }
          }}
        />
        <Button type="button" onClick={handleAddVariable} className="shadow-lg shadow-primary/15">
          <Plus className="mr-2 h-4 w-4" />
          변수 추가
        </Button>
      </div>

      <div className="space-y-2">
        <Label>본문 편집</Label>
        <div className="relative rounded-[1.5rem] border border-border bg-background/90 p-4 shadow-sm">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={syncValue}
            onKeyUp={syncSelection}
            onMouseUp={syncSelection}
            onFocus={syncSelection}
            onClick={syncSelection}
            onBlur={syncSelection}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData('text/plain');
              insertAtSelection(pasted);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                insertAtSelection('\n');
              }
            }}
            className={cn(
              'min-h-[220px] whitespace-pre-wrap break-words rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none ring-0',
              value.length === 0 && 'text-muted-foreground'
            )}
          />
          {value.length === 0 && (
            <div className="pointer-events-none absolute inset-4 whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 text-muted-foreground">
              {`예시: #{이름}님, #{가격} 상품 결제가 #{시간}에 완료되었습니다.`}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          `#&#123;이름&#125;` 형태로 직접 입력해도 자동으로 변수 칩으로 변환됩니다.
        </p>
      </div>
    </div>
  );
}
